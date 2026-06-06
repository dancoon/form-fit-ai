import {
  meanKneeAngle,
  minHipKneeSegmentAngle,
  minKneeAngle,
} from "@/lib/squat/biomechanics";
import { LM } from "@/lib/squat/landmarkIndices";
import type {
  CameraAnglePreset,
  RepTrackingMode,
  ResolvedViewAngle,
} from "@/lib/squat/squatConfig";

function landmarkX(frame: Float32Array, idx: number): number {
  return frame[idx * 4];
}

/**
 * Infer side vs front from horizontal landmark spread.
 * Side/profile: narrow shoulder span; front: wide shoulders/hips in frame.
 */
export function inferViewAngle(frame: Float32Array): ResolvedViewAngle {
  const shoulderSpan = Math.abs(
    landmarkX(frame, LM.LEFT_SHOULDER) - landmarkX(frame, LM.RIGHT_SHOULDER),
  );
  const hipSpan = Math.abs(
    landmarkX(frame, LM.LEFT_HIP) - landmarkX(frame, LM.RIGHT_HIP),
  );
  const span = Math.max(shoulderSpan, hipSpan);
  return span < 0.14 ? "side" : "front";
}

export function resolveViewAngle(
  setting: CameraAnglePreset,
  detected: ResolvedViewAngle,
): ResolvedViewAngle {
  return setting === "auto" ? detected : setting;
}

/** Primary rep-tracking scalar — lower values mean a deeper squat for both modes. */
export function getRepTrackingValue(
  frame: Float32Array,
  mode: RepTrackingMode,
): number {
  switch (mode) {
    case "knee_mean":
      return meanKneeAngle(frame);
    case "knee_min":
      return minKneeAngle(frame);
    default:
      return minHipKneeSegmentAngle(frame);
  }
}

export function isDepthAdequateInWindow(
  sequence: Float32Array[],
  mode: RepTrackingMode,
  threshold: number,
): boolean {
  if (sequence.length === 0) return false;
  let best = Number.POSITIVE_INFINITY;
  for (const frame of sequence) {
    best = Math.min(best, getRepTrackingValue(frame, mode));
  }
  return best <= threshold;
}
