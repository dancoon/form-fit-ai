from __future__ import annotations

from typing import List

import numpy as np

class TemporalProcessor:
    """Handles sequence normalization, smoothing, interpolation, and windowing."""

    def __init__(self, window_size: int = 5):
        self.window_size = window_size

    def smooth_sequence(self, sequence: np.ndarray) -> np.ndarray:
        """Apply moving average smoothing to reduce noise."""
        if len(sequence) < self.window_size:
            return sequence
        smoothed = np.copy(sequence)
        half_w = self.window_size // 2
        for i in range(half_w, len(sequence) - half_w):
            smoothed[i] = np.mean(sequence[i - half_w:i + half_w + 1], axis=0)
        return smoothed

    def interpolate_missing(self, sequence: np.ndarray,
                            visibility_threshold: float = 0.5) -> np.ndarray:
        """Interpolate frames with low visibility landmarks."""
        interpolated = np.copy(sequence)
        num_landmarks = sequence.shape[1] // 4

        for lm_idx in range(num_landmarks):
            vis_idx = lm_idx * 4 + 3
            for frame_idx in range(len(sequence)):
                if sequence[frame_idx, vis_idx] < visibility_threshold:
                    prev_valid = next_valid = None
                    for p in range(frame_idx - 1, -1, -1):
                        if sequence[p, vis_idx] >= visibility_threshold:
                            prev_valid = p
                            break
                    for n in range(frame_idx + 1, len(sequence)):
                        if sequence[n, vis_idx] >= visibility_threshold:
                            next_valid = n
                            break

                    if prev_valid is not None and next_valid is not None:
                        alpha = (frame_idx - prev_valid) / (next_valid - prev_valid)
                        start = lm_idx * 4
                        interpolated[frame_idx, start:start+3] = (
                            (1 - alpha) * sequence[prev_valid, start:start+3] +
                            alpha * sequence[next_valid, start:start+3]
                        )
                    elif prev_valid is not None:
                        start = lm_idx * 4
                        interpolated[frame_idx, start:start+3] = sequence[prev_valid, start:start+3]
                    elif next_valid is not None:
                        start = lm_idx * 4
                        interpolated[frame_idx, start:start+3] = sequence[next_valid, start:start+3]

        return interpolated

    def normalize_sequence_length(self, sequence: np.ndarray,
                                  target_length: int) -> np.ndarray:
        """Resample sequence to target length via linear interpolation."""
        current_length = len(sequence)
        if current_length == target_length:
            return sequence

        indices = np.linspace(0, current_length - 1, target_length)
        resampled = np.zeros((target_length, sequence.shape[1]), dtype=np.float32)

        for i, idx in enumerate(indices):
            lower = int(np.floor(idx))
            upper = min(lower + 1, current_length - 1)
            alpha = idx - lower
            resampled[i] = (1 - alpha) * sequence[lower] + alpha * sequence[upper]

        return resampled

    def create_sliding_windows(self, sequence: np.ndarray,
                               window_size: int,
                               stride: int) -> List[np.ndarray]:
        """Create overlapping sliding windows from a sequence."""
        windows = []
        for start in range(0, len(sequence) - window_size + 1, stride):
            windows.append(sequence[start:start + window_size])
        return windows
