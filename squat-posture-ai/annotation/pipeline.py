"""Orchestration for extract → segment → export annotation workflow."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from annotation.cache import (
    landmark_cache_path,
    list_videos,
    load_landmark_cache,
    load_reps_cache,
    save_landmark_cache,
    save_reps_cache,
)
from annotation.config import AnnotationConfig
from annotation.rep_segmenter import RepBoundary, RepSegmenter

log = logging.getLogger("squat-annotate")

ExtractedData = dict[str, dict[str, Any]]
AllReps = dict[str, list[RepBoundary]]


def extract_all_videos(
    cfg: AnnotationConfig,
    extractor=None,
    sample_every_n: int = 1,
    *,
    use_gpu: bool | None = None,
    backend: str | None = None,
) -> ExtractedData:
    from annotation.pose_extractor import PoseExtractor

    cfg.ensure_dirs()
    extractor = extractor or PoseExtractor(
        model_cache_dir=cfg.pose_model_cache_dir,
        use_gpu=use_gpu,
        backend=backend,
    )

    extracted: ExtractedData = {}
    video_files = list_videos(cfg.video_dir)

    if not video_files:
        log.warning("No videos in %s", cfg.video_dir)
        return extracted

    log.info("Processing %d video(s)", len(video_files))

    for i, video_path in enumerate(video_files, 1):
        video_name = video_path.stem
        cache_path = landmark_cache_path(cfg.landmarks_dir, video_name)

        if cache_path.exists():
            log.info("[%d/%d] %s — cache hit", i, len(video_files), video_name)
            cached = load_landmark_cache(cache_path)
            assert cached is not None
            landmarks = cached["landmarks"]
            metadata = cached["metadata"]
        else:
            log.info("[%d/%d] %s — extracting poses", i, len(video_files), video_name)
            landmarks, metadata = extractor.extract_video(video_path, sample_every_n=sample_every_n)
            save_landmark_cache(cache_path, landmarks, metadata)
            log.info("[%d/%d] %s — cached %d frames → %s", i, len(video_files), video_name, len(landmarks), cache_path)

        extracted[video_name] = {"landmarks": landmarks, "metadata": metadata}
        rate = metadata.get("success_rate")
        if rate is not None:
            log.debug("[%d/%d] %s — pose success %.1f%%", i, len(video_files), video_name, rate * 100)

    return extracted


def segment_all_videos(
    cfg: AnnotationConfig,
    extracted: ExtractedData,
    force_resegment: bool = False,
    visualize: bool = False,
) -> AllReps:
    cfg.ensure_dirs()
    cache_path = cfg.reps_cache_path

    if force_resegment and cache_path.exists():
        cache_path.unlink()
        log.warning("Rep cache deleted — re-segmenting (old annotation indices may be invalid)")

    all_reps = load_reps_cache(cache_path)
    segmenter = RepSegmenter(cfg)

    if all_reps is None:
        log.info("Segmenting %d video(s)", len(extracted))
        all_reps = {}
        for video_name, data in extracted.items():
            landmarks = data["landmarks"]
            reps = segmenter.segment_reps(landmarks)
            all_reps[video_name] = reps
            if visualize:
                segmenter.visualize_segmentation(landmarks, reps, title=video_name)
            log.info("  %s — %d rep(s)", video_name, len(reps))
        save_reps_cache(all_reps, cache_path)
    else:
        total = sum(len(r) for r in all_reps.values())
        log.info("Rep cache loaded — %d video(s), %d rep(s)", len(all_reps), total)
        if visualize:
            for video_name, reps in all_reps.items():
                if video_name in extracted:
                    segmenter.visualize_segmentation(
                        extracted[video_name]["landmarks"], reps, title=video_name
                    )

    return all_reps


def visualize_segmentation_results(
    cfg: AnnotationConfig,
    extracted: ExtractedData,
    all_reps: AllReps,
    *,
    output_dir: Path | None = None,
    video_name: str | None = None,
    show: bool = False,
    reps_only: bool = False,
) -> int:
    """Write knee-angle rep segmentation plots (PNG) for review."""
    out = output_dir or cfg.segmentation_viz_dir
    out.mkdir(parents=True, exist_ok=True)

    segmenter = RepSegmenter(cfg)
    saved = 0

    for name, data in extracted.items():
        if video_name is not None and name != video_name:
            continue

        reps = all_reps.get(name, [])
        if reps_only and not reps:
            continue

        segmenter.visualize_segmentation(
            data["landmarks"],
            reps,
            title=name,
            output_path=out / f"{name}_reps.png",
            show=show and video_name is not None,
        )
        saved += 1
        log.info("  %s — %d rep(s) -> %s", name, len(reps), out / f"{name}_reps.png")

    return saved
