"""Annotation pipeline configuration — aligned with training Config constants."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

RepTrackingMode = Literal["knee_min", "knee_mean"]
ViewAngle = Literal["side", "front"]


@dataclass(frozen=True)
class RepThresholds:
    """Rep-detection thresholds — keep in sync with mobile/src/lib/squat/squatConfig.ts."""

    tracking_mode: RepTrackingMode
    down_angle: float = 115.0
    up_angle: float = 150.0 
    adequate_depth: float = 95.0
    calibration_frames: int = 10
    thigh_smooth_alpha: float = 0.6
    standing_leg_min: float = 167.0
    standing_leg_max: float = 180.0
    min_rep_frames: int = 12
    min_descent_from_stand: float = 22.0
    end_descent_margin: float = 10.0


SIDE_REP = RepThresholds(tracking_mode="knee_min", standing_leg_min=167.0)
FRONT_REP = RepThresholds(tracking_mode="knee_mean", standing_leg_min=160.0)


def rep_thresholds_for_view(view: ViewAngle) -> RepThresholds:
    return SIDE_REP if view == "side" else FRONT_REP


@dataclass
class AnnotationConfig:
    """Paths and thresholds for the squat annotation workflow."""

    num_landmarks: int = 33
    coords_per_landmark: int = 4
    raw_feature_dim: int = 132

    max_rep_frames: int = 120
    # Clockwise degrees for annotator frame preview (0, 90, 180, 270). Phone videos often need 90.
    video_display_rotation_cw: int = 90

    # Must match utils.config.Config.sequence_length and mobile SQUAT_SEQUENCE_LENGTH
    target_sequence_length: int = 45

    base_dir: Path = field(default_factory=lambda: Path("data"))
    video_dir: Path | None = None
    output_dir: Path | None = None
    landmarks_dir: Path | None = None
    pose_model_cache_dir: Path = field(default_factory=lambda: Path("models/pose"))

    def __post_init__(self) -> None:
        self.base_dir = Path(self.base_dir)
        if self.video_dir is None:
            self.video_dir = self.base_dir / "raw" / "videos"
        else:
            self.video_dir = Path(self.video_dir)
        if self.output_dir is None:
            self.output_dir = self.base_dir / "annotated"
        else:
            self.output_dir = Path(self.output_dir)
        if self.landmarks_dir is None:
            self.landmarks_dir = self.base_dir / "landmarks"
        else:
            self.landmarks_dir = Path(self.landmarks_dir)
        self.pose_model_cache_dir = Path(self.pose_model_cache_dir)

    def ensure_dirs(self) -> None:
        for d in (self.video_dir, self.output_dir, self.landmarks_dir, self.pose_model_cache_dir):
            d.mkdir(parents=True, exist_ok=True)

    @property
    def annotations_path(self) -> Path:
        return self.output_dir / "annotations.json"

    @property
    def dataset_path(self) -> Path:
        return self.output_dir / "annotated_dataset.npz"

    @property
    def reps_cache_path(self) -> Path:
        return self.landmarks_dir / "all_reps_cache.json"

    @property
    def segmentation_viz_dir(self) -> Path:
        return self.output_dir / "segmentation_viz"
