"""Display orientation for phone videos (OpenCV ignores rotation metadata)."""
from __future__ import annotations

import cv2
import numpy as np

# Clockwise degrees: 0, 90, 180, 270. Default 90 fixes typical Android portrait-in-landscape files.
DEFAULT_DISPLAY_ROTATION_CW = 90


def orient_frame_for_display(frame: np.ndarray, rotate_cw: int = DEFAULT_DISPLAY_ROTATION_CW) -> np.ndarray:
    """Rotate a BGR frame for correct upright display in matplotlib."""
    if rotate_cw == 0:
        return frame
    if rotate_cw == 90:
        return cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
    if rotate_cw == 180:
        return cv2.rotate(frame, cv2.ROTATE_180)
    if rotate_cw == 270:
        return cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE)
    raise ValueError(f"rotate_cw must be 0, 90, 180, or 270 — got {rotate_cw}")
