from __future__ import annotations

from typing import Any, Dict, List

import numpy as np

class RepDetector:
    """Detects squat repetitions and phases from knee angle signal."""

    def __init__(self, standing_threshold: float = 160.0,
                 bottom_threshold: float = 90.0):
        self.standing_threshold = standing_threshold
        self.bottom_threshold = bottom_threshold

    def detect_phases(self, knee_angles: np.ndarray) -> Dict[str, Any]:
        """Segment squat into eccentric/concentric phases."""
        phases = np.zeros(len(knee_angles), dtype=np.int32)
        # 0=standing, 1=eccentric (descending), 2=bottom, 3=concentric (ascending)

        for i in range(1, len(knee_angles)):
            if knee_angles[i] >= self.standing_threshold:
                phases[i] = 0
            elif knee_angles[i] <= self.bottom_threshold:
                phases[i] = 2
            elif knee_angles[i] < knee_angles[i - 1]:
                phases[i] = 1  # eccentric
            else:
                phases[i] = 3  # concentric

        return {'phases': phases, 'num_frames': len(knee_angles)}

    def count_reps(self, knee_angles: np.ndarray) -> int:
        """Count complete squat repetitions."""
        phase_info = self.detect_phases(knee_angles)
        phases = phase_info['phases']

        reps = 0
        saw_bottom = False
        for i in range(1, len(phases)):
            if phases[i] == 2:
                saw_bottom = True
            elif phases[i] == 0 and saw_bottom:
                reps += 1
                saw_bottom = False

        return reps

    def get_bottom_frames(self, knee_angles: np.ndarray) -> List[int]:
        """Find frame indices at bottom of each rep."""
        bottoms = []
        in_descent = False
        min_angle = float('inf')
        min_idx = 0

        for i in range(len(knee_angles)):
            if knee_angles[i] < self.standing_threshold:
                in_descent = True
                if knee_angles[i] < min_angle:
                    min_angle = knee_angles[i]
                    min_idx = i
            elif in_descent and knee_angles[i] >= self.standing_threshold:
                bottoms.append(min_idx)
                in_descent = False
                min_angle = float('inf')

        return bottoms
