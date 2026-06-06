#!/usr/bin/env python3
"""CLI for the squat video annotation pipeline."""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

# Quiet TF/absl before any heavy imports (mediapipe can pull these in).
from annotation.log import setup_logging

log = logging.getLogger("squat-annotate")


def _load_extracted_from_cache(cfg) -> dict:
    from annotation.cache import landmark_cache_path, list_videos, load_landmark_cache

    extracted = {}
    for video_path in list_videos(cfg.video_dir):
        video_name = video_path.stem
        cache_path = landmark_cache_path(cfg.landmarks_dir, video_name)
        cached = load_landmark_cache(cache_path)
        if cached:
            extracted[video_name] = cached
    return extracted


def cmd_extract(cfg, args: argparse.Namespace) -> int:
    from annotation.pipeline import extract_all_videos
    from annotation.pose_extractor import (
        gpu_available,
        is_wsl,
        mediapipe_tasks_gpu_supported,
        wsl_gpu_allowed,
    )

    backend = args.backend
    use_gpu = False

    if args.cpu:
        use_gpu = False
        backend = backend or ("solutions" if is_wsl() else None)
    elif args.gpu and not mediapipe_tasks_gpu_supported():
        if sys.platform == "win32":
            log.warning(
                "Windows: MediaPipe GPU delegate is not supported — using CPU Tasks API. "
                "Omit --gpu or pass --cpu explicitly."
            )
        else:
            log.warning(
                "WSL detected: MediaPipe GPU Tasks API crashes here (EGL/DRI3). "
                "Using CPU solutions backend instead. "
                "For GPU: run Python on native Linux, or set ANNOTATION_POSE_ALLOW_WSL_GPU=1 to force (unstable)."
            )
        use_gpu = False
        backend = backend or ("solutions" if is_wsl() else None)
    elif is_wsl():
        use_gpu = False
        backend = backend or "solutions"
        if not args.cpu:
            log.info(
                "WSL detected — using CPU solutions backend (stable). "
                "For GPU use native Linux with --gpu."
            )
    else:
        use_gpu = args.gpu or (not args.cpu and gpu_available())

    log.info("Extract — videos: %s", cfg.video_dir)
    log.info("Landmark cache: %s", cfg.landmarks_dir)
    extracted = extract_all_videos(
        cfg,
        sample_every_n=args.sample_every,
        use_gpu=use_gpu,
        backend=backend,
    )
    if not extracted:
        log.warning("Nothing extracted. Add videos to %s", cfg.video_dir)
        return 1
    log.info("Done — %d video(s) with landmarks", len(extracted))
    log.info("Next: python run_annotation.py segment")
    return 0


def cmd_segment(cfg, args: argparse.Namespace) -> int:
    from annotation.pipeline import segment_all_videos

    extracted = _load_extracted_from_cache(cfg)
    if not extracted:
        log.error("No landmark caches. Run: python run_annotation.py extract")
        return 1

    log.info("Segment — %d video(s) with landmark caches", len(extracted))
    all_reps = segment_all_videos(cfg, extracted, force_resegment=args.force)
    total_reps = sum(len(r) for r in all_reps.values())
    log.info("Done — %d video(s), %d rep(s)", len(all_reps), total_reps)
    log.info("Next: python -m jupyter lab notebooks/annotate.ipynb")
    return 0


def cmd_export(cfg, args: argparse.Namespace) -> int:
    from annotation.exporter import DataExporter
    from annotation.quality import run_quality_checks
    from annotation.store import AnnotationStore

    extracted = _load_extracted_from_cache(cfg)
    store = AnnotationStore(cfg.output_dir, log_load=False)
    if not store.annotations:
        log.error("No annotations. Label reps in notebooks/annotate.ipynb first.")
        return 1

    log.info("Export — %d annotated video(s)", len(store.annotations))
    exporter = DataExporter(cfg)
    path = exporter.export_for_training(extracted, store.annotations)
    if not path:
        log.error("Export produced no sequences")
        return 1

    log.info("Wrote %s", path)
    if args.check:
        run_quality_checks(path)
    log.info("Next: load .npz in notebooks/train.ipynb")
    return 0


def cmd_visualize(cfg, args: argparse.Namespace) -> int:
    from annotation.cache import load_reps_cache
    from annotation.pipeline import visualize_segmentation_results

    extracted = _load_extracted_from_cache(cfg)
    if not extracted:
        log.error("No landmark caches. Run: python run_annotation.py extract")
        return 1

    all_reps = load_reps_cache(cfg.reps_cache_path)
    if not all_reps:
        log.error("No rep cache. Run: python run_annotation.py segment")
        return 1

    out = args.output_dir or cfg.segmentation_viz_dir
    log.info("Visualize — writing plots to %s", out.resolve())
    count = visualize_segmentation_results(
        cfg,
        extracted,
        all_reps,
        output_dir=out,
        video_name=args.video,
        show=args.show,
        reps_only=args.reps_only,
    )
    log.info("Done — %d plot(s) in %s", count, out.resolve())
    return 0


def cmd_status(cfg, _args: argparse.Namespace) -> int:
    from annotation.cache import list_videos, load_reps_cache
    from annotation.store import AnnotationStore

    cfg.ensure_dirs()
    videos = list_videos(cfg.video_dir)
    extracted = _load_extracted_from_cache(cfg)
    store = AnnotationStore(cfg.output_dir, log_load=False)
    all_reps = load_reps_cache(cfg.reps_cache_path) or {}
    total_reps = sum(len(r) for r in all_reps.values())
    annotated = sum(len(v) for v in store.annotations.values())

    log.info("── Annotation pipeline status ──")
    log.info("Data root:     %s", cfg.base_dir.resolve())
    log.info("Videos:        %d in %s", len(videos), cfg.video_dir)
    log.info("Landmarks:     %d cached in %s", len(extracted), cfg.landmarks_dir)
    log.info("Segmentation:  %d video(s), %d rep(s)", len(all_reps), total_reps)
    if total_reps:
        pct = annotated / total_reps * 100
        log.info("Annotations:   %d / %d reps (%.0f%%)", annotated, total_reps, pct)
    else:
        log.info("Annotations:   %d rep(s) labeled", annotated)

    if cfg.annotations_path.exists():
        log.info("Labels file:   %s", cfg.annotations_path)
    if cfg.dataset_path.exists():
        log.info("Dataset:       %s", cfg.dataset_path)

    if videos and not extracted:
        log.info("→ Run: python run_annotation.py extract")
    elif extracted and not all_reps:
        log.info("→ Run: python run_annotation.py segment")
    elif all_reps and annotated < total_reps:
        log.info("→ Run: python -m jupyter lab notebooks/annotate.ipynb")
    elif annotated and not cfg.dataset_path.exists():
        log.info("→ Run: python run_annotation.py export --check")
    elif cfg.dataset_path.exists():
        log.info("→ Ready for notebooks/train.ipynb")

    if log.isEnabledFor(logging.DEBUG):
        for v in videos[:20]:
            name = v.stem
            frames = extracted[name]["landmarks"].shape[0] if name in extracted else "—"
            reps = len(all_reps.get(name, []))
            labels = len(store.annotations.get(name, []))
            log.debug("  %s  frames=%s  reps=%s  labels=%s", name, frames, reps, labels)
        if len(videos) > 20:
            log.debug("  … and %d more videos", len(videos) - 20)

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Squat video annotation pipeline")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path("data"),
        help="Base data directory (default: data/)",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Debug logging (per-video breakdown on status)",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_extract = sub.add_parser("extract", help="Extract BlazePose landmarks from videos")
    p_extract.add_argument("--sample-every", type=int, default=1, help="Sample every N frames")
    p_extract.add_argument(
        "--gpu",
        action="store_true",
        help="Use GPU delegate (Tasks API). Auto-enabled when nvidia-smi works.",
    )
    p_extract.add_argument(
        "--cpu",
        action="store_true",
        help="Force CPU/solutions backend (safe on WSL if GPU path segfaults)",
    )
    p_extract.add_argument(
        "--backend",
        choices=("tasks", "solutions"),
        default=None,
        help="Pose API: tasks (.task file) or solutions (classic, WSL-safe)",
    )

    p_segment = sub.add_parser("segment", help="Segment squat reps from cached landmarks")
    p_segment.add_argument(
        "--force",
        action="store_true",
        help="Discard rep cache and re-segment (invalidates existing annotation indices)",
    )

    p_export = sub.add_parser("export", help="Export annotated_dataset.npz for training")
    p_export.add_argument("--check", action="store_true", help="Run quality checks after export")

    sub.add_parser("status", help="Show pipeline progress")

    p_viz = sub.add_parser("visualize", help="Plot rep segmentation charts (PNG)")
    p_viz.add_argument(
        "--video",
        default=None,
        help="Single video stem (e.g. VID_20260330_110839); omit for all videos",
    )
    p_viz.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Directory for PNG plots (default: data/annotated/segmentation_viz/)",
    )
    p_viz.add_argument(
        "--show",
        action="store_true",
        help="Open interactive window (use with --video)",
    )
    p_viz.add_argument(
        "--reps-only",
        action="store_true",
        help="Skip videos with zero detected reps",
    )

    args = parser.parse_args()
    global log
    use_gpu_log = getattr(args, "gpu", False)
    log = setup_logging(verbose=args.verbose, use_gpu=use_gpu_log)

    from annotation.config import AnnotationConfig

    cfg = AnnotationConfig(base_dir=args.data_dir)
    log.debug("Config: video_dir=%s output_dir=%s", cfg.video_dir, cfg.output_dir)

    handlers = {
        "extract": cmd_extract,
        "segment": cmd_segment,
        "export": cmd_export,
        "visualize": cmd_visualize,
        "status": cmd_status,
    }
    return handlers[args.command](cfg, args)


if __name__ == "__main__":
    sys.exit(main())
