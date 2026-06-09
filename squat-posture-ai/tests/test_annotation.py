"""Tests for squat annotation pipeline."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from annotation.config import AnnotationConfig
from annotation.exporter import DataExporter
from annotation.rep_segmenter import RepSegmenter
from annotation.store import AnnotationStore


def _set_lm(frame: np.ndarray, idx: int, x: float, y: float, z: float = 0.0) -> None:
    frame[idx * 4 : idx * 4 + 3] = (x, y, z)
    frame[idx * 4 + 3] = 1.0


def _side_standing_frame() -> np.ndarray:
    """Side-view standing pose aligned with mobile squat.test.ts fixtures."""
    frame = np.zeros(132, dtype=np.float32)
    for idx, x, y in (
        (11, 0.55, 0.28),
        (12, 0.45, 0.28),
        (23, 0.54, 0.52),
        (24, 0.46, 0.52),
        (25, 0.55, 0.72),
        (26, 0.45, 0.72),
        (27, 0.55, 0.92),
        (28, 0.45, 0.92),
    ):
        _set_lm(frame, idx, x, y)
    return frame


def _side_deep_frame() -> np.ndarray:
    """Side-view deep squat — near leg bent (mobile squat.test.ts)."""
    frame = _side_standing_frame()
    for idx, x, y in ((23, 0.52, 0.68), (25, 0.38, 0.71), (27, 0.36, 0.88)):
        _set_lm(frame, idx, x, y)
    return frame


def _lerp_frames(stand: np.ndarray, deep: np.ndarray, alpha: float) -> np.ndarray:
    out = stand.copy()
    for idx in (23, 24, 25, 26, 27, 28):
        base = idx * 4
        out[base : base + 3] = (1 - alpha) * stand[base : base + 3] + alpha * deep[base : base + 3]
    return out


def _squat_rep_sequence(num_frames: int = 40, *, depth_alpha: float = 1.0) -> np.ndarray:
    """One rep: standing → bottom → standing."""
    stand = _side_standing_frame()
    deep = _side_deep_frame()
    frames = []
    for i in range(num_frames):
        t = i / max(1, num_frames - 1)
        if t < 0.4:
            alpha = (t / 0.4) * depth_alpha
        elif t < 0.6:
            alpha = depth_alpha
        else:
            alpha = (1.0 - (t - 0.6) / 0.4) * depth_alpha
        frames.append(_lerp_frames(stand, deep, alpha))
    return np.array(frames, dtype=np.float32)


def test_rep_segmenter_finds_rep():
    cfg = AnnotationConfig()
    segmenter = RepSegmenter(cfg)
    landmarks = _squat_rep_sequence()
    reps = segmenter.segment_reps(landmarks)
    assert len(reps) >= 1


def test_rep_segmenter_matches_mobile_thresholds():
    cfg = AnnotationConfig()
    segmenter = RepSegmenter(cfg)
    frame = _side_standing_frame()
    assert segmenter.infer_view_angle(frame) == "side"
    reps = segmenter.segment_reps(_squat_rep_sequence(60))
    start, end = reps[0]
    assert end - start + 1 >= 12


def test_rep_segmenter_finds_shallow_rep():
    """Partial-depth reps must segment so insufficient_depth can be labeled."""
    from annotation.config import rep_thresholds_for_view

    cfg = AnnotationConfig()
    segmenter = RepSegmenter(cfg)
    landmarks = _squat_rep_sequence(60, depth_alpha=0.55)
    rep = rep_thresholds_for_view("side")

    deepest = min(segmenter.compute_tracking_values(landmarks, "side"))
    assert deepest > rep.adequate_depth

    reps = segmenter.segment_reps(landmarks)
    assert len(reps) >= 1


def test_annotation_store_roundtrip(tmp_path: Path):
    store = AnnotationStore(tmp_path)
    store.annotate_rep(
        video_name="vid1",
        rep_index=0,
        start_frame=0,
        end_frame=30,
        is_correct=False,
        knee_valgus=True,
    )
    store.save()

    store2 = AnnotationStore(tmp_path)
    ann = store2.get_rep_annotation("vid1", 0)
    assert ann is not None
    assert ann["label"] == 1
    assert ann["errors"]["knee_valgus"] is True


def test_exporter_produces_training_arrays(tmp_path: Path):
    cfg = AnnotationConfig(base_dir=tmp_path)
    cfg.ensure_dirs()

    landmarks = _squat_rep_sequence(50)
    extracted = {"vid1": {"landmarks": landmarks, "metadata": {}}}

    store = AnnotationStore(cfg.output_dir)
    store.annotate_rep("vid1", 0, 0, 40, is_correct=True)
    store.save()

    exporter = DataExporter(cfg)
    path = exporter.export_for_training(extracted, store.annotations, target_sequence_length=30)
    assert path

    data = np.load(path)
    assert data["sequences"].shape == (1, 30, 132)
    assert data["labels"][0] == 0
    assert data["error_vectors"].shape == (1, 3)


def test_annotations_json_format(tmp_path: Path):
    store = AnnotationStore(tmp_path)
    store.annotate_rep("v", 0, 5, 25, is_correct=True)
    store.save()

    raw = json.loads((tmp_path / "annotations.json").read_text(encoding="utf-8"))
    assert "v" in raw
    assert raw["v"][0]["error_vector"] == [0, 0, 0]
