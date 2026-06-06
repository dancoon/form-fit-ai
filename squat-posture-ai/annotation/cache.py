"""Disk caches for extracted landmarks and rep boundaries."""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import numpy as np

log = logging.getLogger("squat-annotate")

from annotation.rep_segmenter import RepBoundary

VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}


def list_videos(video_dir: Path) -> list[Path]:
    if not video_dir.exists():
        return []
    return sorted(
        f for f in video_dir.iterdir() if f.is_file() and f.suffix.lower() in VIDEO_EXTENSIONS
    )


def resolve_video_path(video_dir: Path, video_name: str) -> Path | None:
    for ext in VIDEO_EXTENSIONS:
        candidate = video_dir / f"{video_name}{ext}"
        if candidate.exists():
            return candidate
    for f in video_dir.iterdir():
        if f.stem == video_name:
            return f
    return None


def landmark_cache_path(landmarks_dir: Path, video_name: str) -> Path:
    return landmarks_dir / f"{video_name}_landmarks.npz"


def load_landmark_cache(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    cached = np.load(str(path), allow_pickle=True)
    return {
        "landmarks": cached["landmarks"],
        "metadata": cached["metadata"].item(),
    }


def save_landmark_cache(path: Path, landmarks: np.ndarray, metadata: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    np.savez(str(path), landmarks=landmarks, metadata=metadata)


def save_reps_cache(all_reps: dict[str, list[RepBoundary]], path: Path) -> None:
    serializable = {k: [list(r) for r in v] for k, v in all_reps.items()}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(serializable, indent=2), encoding="utf-8")
    log.info("Rep cache saved → %s", path)


def load_reps_cache(path: Path) -> dict[str, list[RepBoundary]] | None:
    if not path.exists():
        return None
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {k: [tuple(r) for r in v] for k, v in raw.items()}
