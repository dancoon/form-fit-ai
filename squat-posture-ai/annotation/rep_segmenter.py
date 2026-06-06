"""Automatic squat rep segmentation from landmark sequences."""
from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

import matplotlib.pyplot as plt
import numpy as np

from annotation.config import RepThresholds, ViewAngle, rep_thresholds_for_view

if TYPE_CHECKING:
    from annotation.config import AnnotationConfig

RepBoundary = tuple[int, int]

_EPS = 1e-8


class RepSegmenter:
    """Segments squat reps using the mobile SquatRepTracker FSM (knee-based, calibrated).

    Unlike live rep counting, annotation accepts partial-depth reps so labelers can
    mark insufficient_depth and related errors.
    """

    LEFT_SHOULDER = 11
    RIGHT_SHOULDER = 12
    LEFT_HIP = 23
    RIGHT_HIP = 24
    LEFT_KNEE = 25
    RIGHT_KNEE = 26
    LEFT_ANKLE = 27
    RIGHT_ANKLE = 28

    def __init__(self, config: AnnotationConfig) -> None:
        self.cfg = config

    def _get_coords(self, frame: np.ndarray, idx: int) -> np.ndarray:
        return frame[idx * 4 : idx * 4 + 3]

    def _landmark_x(self, frame: np.ndarray, idx: int) -> float:
        return float(frame[idx * 4])

    def _compute_angle(
        self,
        a: np.ndarray,
        b: np.ndarray,
        c: np.ndarray,
    ) -> float:
        ba = a - b
        bc = c - b
        cos_a = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + _EPS)
        cos_a = np.clip(cos_a, -1.0, 1.0)
        return float(np.degrees(np.arccos(cos_a)))

    def _knee_angles(self, frame: np.ndarray) -> tuple[float, float]:
        left = self._compute_angle(
            self._get_coords(frame, self.LEFT_HIP),
            self._get_coords(frame, self.LEFT_KNEE),
            self._get_coords(frame, self.LEFT_ANKLE),
        )
        right = self._compute_angle(
            self._get_coords(frame, self.RIGHT_HIP),
            self._get_coords(frame, self.RIGHT_KNEE),
            self._get_coords(frame, self.RIGHT_ANKLE),
        )
        return left, right

    def _mean_knee_angle(self, frame: np.ndarray) -> float:
        left, right = self._knee_angles(frame)
        return (left + right) / 2

    def _min_knee_angle(self, frame: np.ndarray) -> float:
        return min(self._knee_angles(frame))

    def _get_rep_tracking_value(self, frame: np.ndarray, mode: str) -> float:
        if mode == "knee_mean":
            return self._mean_knee_angle(frame)
        return self._min_knee_angle(frame)

    def infer_view_angle(self, frame: np.ndarray) -> ViewAngle:
        """Infer side vs front from horizontal landmark spread (mobile repMetrics.inferViewAngle)."""
        shoulder_span = abs(
            self._landmark_x(frame, self.LEFT_SHOULDER)
            - self._landmark_x(frame, self.RIGHT_SHOULDER)
        )
        hip_span = abs(
            self._landmark_x(frame, self.LEFT_HIP) - self._landmark_x(frame, self.RIGHT_HIP)
        )
        return "side" if max(shoulder_span, hip_span) < 0.14 else "front"

    def _infer_view_angle_median(self, landmarks: np.ndarray) -> ViewAngle:
        sample = landmarks[: min(30, len(landmarks))]
        views = [self.infer_view_angle(frame) for frame in sample]
        return "side" if views.count("side") >= views.count("front") else "front"

    @staticmethod
    def _descent_from_stand(raw_primary: float, standing_baseline: float | None) -> float:
        stand = standing_baseline if standing_baseline is not None else raw_primary
        return stand - raw_primary

    @staticmethod
    def _should_start_rep(
        rep: RepThresholds,
        raw_primary: float,
        standing_baseline: float | None,
    ) -> bool:
        if raw_primary < rep.down_angle:
            return True
        if standing_baseline is None:
            return False
        return RepSegmenter._descent_from_stand(raw_primary, standing_baseline) >= rep.min_descent_from_stand

    @staticmethod
    def _should_end_rep(
        rep: RepThresholds,
        raw_primary: float,
        standing_baseline: float | None,
    ) -> bool:
        """End when the lifter returns near standing — depth at bottom is not required."""
        if raw_primary >= rep.up_angle:
            return True
        if standing_baseline is not None:
            return RepSegmenter._descent_from_stand(raw_primary, standing_baseline) <= rep.end_descent_margin
        return False

    def _calibrate_baseline(self, landmarks: np.ndarray, rep: RepThresholds) -> float | None:
        """Offline calibration from the most-extended knee frames in the clip.

        Live mobile calibration requires ~167° leg extension, which MediaPipe rarely
        reports on real video. For annotation we take the top ~30% knee angles in
        the clip as standing-ish and mirror mobile's high-percentile baseline.
        """
        if len(landmarks) == 0:
            return None

        knee_angles = [self._mean_knee_angle(frame) for frame in landmarks]
        primaries = [
            self._get_rep_tracking_value(frame, rep.tracking_mode) for frame in landmarks
        ]

        stand_threshold = float(np.percentile(knee_angles, 70))
        samples = [
            primaries[i]
            for i, knee in enumerate(knee_angles)
            if knee >= stand_threshold
        ]
        if len(samples) < 3:
            samples = primaries

        sorted_samples = sorted(samples)
        high_count = max(3, int(len(sorted_samples) * 0.35))
        high = sorted_samples[-high_count:]
        return sum(high) / len(high)

    def compute_tracking_values(self, landmarks: np.ndarray, view: ViewAngle | None = None) -> np.ndarray:
        rep = rep_thresholds_for_view(view or self._infer_view_angle_median(landmarks))
        return np.array(
            [self._get_rep_tracking_value(frame, rep.tracking_mode) for frame in landmarks],
            dtype=np.float64,
        )

    def segment_reps(self, landmarks: np.ndarray) -> list[RepBoundary]:
        if len(landmarks) == 0:
            return []

        view = self._infer_view_angle_median(landmarks)
        rep = rep_thresholds_for_view(view)
        standing_baseline = self._calibrate_baseline(landmarks, rep)
        if standing_baseline is None:
            return []

        stage = "up"
        rep_start: int | None = None
        peak_descent = 0.0
        reps: list[RepBoundary] = []

        for i, frame in enumerate(landmarks):
            raw_primary = self._get_rep_tracking_value(frame, rep.tracking_mode)

            if stage == "up":
                if self._should_start_rep(rep, raw_primary, standing_baseline):
                    stage = "down"
                    rep_start = i
                    peak_descent = self._descent_from_stand(raw_primary, standing_baseline)
            else:
                peak_descent = max(
                    peak_descent,
                    self._descent_from_stand(raw_primary, standing_baseline),
                )

                if self._should_end_rep(rep, raw_primary, standing_baseline):
                    if rep_start is not None:
                        rep_length = i - rep_start + 1
                        # Require visible descent so standing noise is not segmented.
                        if (
                            rep.min_rep_frames <= rep_length <= self.cfg.max_rep_frames
                            and peak_descent >= rep.min_descent_from_stand
                        ):
                            reps.append((rep_start, i))
                    stage = "up"
                    rep_start = None
                    peak_descent = 0.0

        return reps

    def visualize_segmentation(
        self,
        landmarks: np.ndarray,
        reps: list[RepBoundary],
        title: str = "",
        *,
        output_path: Path | None = None,
        show: bool = False,
    ) -> Path | None:
        view = self._infer_view_angle_median(landmarks)
        rep = rep_thresholds_for_view(view)
        values = self.compute_tracking_values(landmarks, view)
        standing_baseline = self._calibrate_baseline(landmarks, rep)

        fig, ax = plt.subplots(1, 1, figsize=(16, 4))
        ax.plot(values, "b-", linewidth=1, alpha=0.8, label=f"Tracking ({rep.tracking_mode})")
        if standing_baseline is not None:
            ax.axhline(
                y=standing_baseline,
                color="purple",
                linestyle=":",
                alpha=0.6,
                label=f"Standing baseline ({standing_baseline:.0f}°)",
            )
        ax.axhline(
            y=rep.down_angle,
            color="orange",
            linestyle="--",
            alpha=0.5,
            label="Down angle",
        )
        ax.axhline(
            y=rep.adequate_depth,
            color="r",
            linestyle="--",
            alpha=0.5,
            label="Adequate depth",
        )
        ax.axhline(
            y=rep.up_angle,
            color="g",
            linestyle="--",
            alpha=0.5,
            label="Up angle",
        )

        colors = plt.cm.Set2(np.linspace(0, 1, max(len(reps), 1)))
        for idx, (start, end) in enumerate(reps):
            ax.axvspan(start, end, alpha=0.2, color=colors[idx % len(colors)])
            mid = (start + end) / 2
            ax.text(mid, ax.get_ylim()[1] * 0.95, f"Rep {idx + 1}", ha="center", fontsize=9)

        ax.set_xlabel("Frame")
        ax.set_ylabel("Knee angle (degrees)")
        ax.set_title(
            f"Rep Segmentation ({view}) - {title} ({len(reps)} reps detected)"
        )
        ax.legend(loc="lower right")
        ax.grid(True, alpha=0.3)
        plt.tight_layout()

        saved: Path | None = None
        if output_path is not None:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            fig.savefig(output_path, dpi=120, bbox_inches="tight")
            saved = output_path

        if show:
            plt.show()
        plt.close(fig)
        return saved
