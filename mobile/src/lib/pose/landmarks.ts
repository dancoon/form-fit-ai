import { KnownPoseLandmarkConnections } from "react-native-mediapipe-posedetection";

/** MediaPipe BlazePose outputs 33 landmarks in normalized image space (0–1). */
export const POSE_LANDMARK_COUNT = 33;
export const POSE_LANDMARKS_FLOAT_COUNT = POSE_LANDMARK_COUNT * 2;

/** Official MediaPipe pose skeleton edges (matches default visualization). */
export const POSE_CONNECTIONS = KnownPoseLandmarkConnections;
export const POSE_CONNECTION_COUNT = POSE_CONNECTIONS.length;

export interface PosePoint {
  x: number;
  y: number;
}

export interface FrameDims {
  width: number;
  height: number;
}

export interface ViewPointConverter {
  convertPoint: (frame: FrameDims, p: PosePoint) => PosePoint;
}

export function createLandmarksBuffer(): Float32Array {
  return new Float32Array(POSE_LANDMARKS_FLOAT_COUNT);
}

export function clearLandmarksBuffer(out: Float32Array): void {
  out.fill(0);
}

/** Writes [x0,y0,…,x32,y32] into `out` for direct WebGL uniform upload. */
export function writeLandmarksToBuffer(
  landmarks: readonly PosePoint[],
  out: Float32Array,
): Float32Array {
  const count = Math.min(POSE_LANDMARK_COUNT, landmarks.length);
  for (let i = 0; i < count; i++) {
    out[i * 2] = landmarks[i].x;
    out[i * 2 + 1] = landmarks[i].y;
  }
  return out;
}

/**
 * Maps MediaPipe normalized frame coords to normalized view coords (0–1)
 * so overlay markers align with the live camera preview.
 */
export function writeViewLandmarksToBuffer(
  landmarks: readonly PosePoint[],
  frame: FrameDims,
  converter: ViewPointConverter,
  viewWidth: number,
  viewHeight: number,
  out: Float32Array,
): Float32Array {
  const count = Math.min(POSE_LANDMARK_COUNT, landmarks.length);
  for (let i = 0; i < count; i++) {
    const view = converter.convertPoint(frame, landmarks[i]);
    out[i * 2] = viewWidth > 0 ? view.x / viewWidth : 0;
    out[i * 2 + 1] = viewHeight > 0 ? view.y / viewHeight : 0;
  }
  return out;
}
