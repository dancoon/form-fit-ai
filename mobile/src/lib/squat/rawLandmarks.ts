import type { Landmark } from "react-native-mediapipe-posedetection";
import { POSE_LANDMARK_COUNT } from "@/lib/pose/landmarks";
import { SQUAT_RAW_LANDMARK_DIM } from "@/lib/squat/constants";

/**
 * Canonical pose frame for model + rep detection: raw MediaPipe normalized coords
 * (x/y/z/visibility). Overlay rendering uses view-mapped coords separately in
 * writeViewLandmarksToBuffer — only display is transformed, not inference.
 */
export function createRawLandmarksBuffer(): Float32Array {
  return new Float32Array(SQUAT_RAW_LANDMARK_DIM);
}

export function writeRawLandmarksToBuffer(
  landmarks: readonly Landmark[],
  out: Float32Array,
): Float32Array {
  const count = Math.min(POSE_LANDMARK_COUNT, landmarks.length);

  for (let i = 0; i < count; i++) {
    const lm = landmarks[i];
    const base = i * 4;
    out[base] = lm.x;
    out[base + 1] = lm.y;
    out[base + 2] = lm.z;
    out[base + 3] = lm.visibility ?? 1;
  }

  return out;
}

/** Allocates a new frame (tests, one-off use). Prefer buffer reuse on the pose hot path. */
export function landmarksToRawFrame(
  landmarks: readonly Landmark[],
): Float32Array {
  return writeRawLandmarksToBuffer(landmarks, createRawLandmarksBuffer());
}

/** Snapshot for rep window storage when the live buffer is reused each frame. */
export function copyRawLandmarksFrame(frame: Float32Array): Float32Array {
  return frame.slice();
}
