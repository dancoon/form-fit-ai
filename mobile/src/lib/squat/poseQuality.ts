import { LM } from "@/lib/squat/landmarkIndices";
import type { PoseQualityConfig } from "@/lib/squat/squatConfig";

const KEY_LANDMARKS = [
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
  LM.LEFT_KNEE,
  LM.RIGHT_KNEE,
  LM.LEFT_ANKLE,
  LM.RIGHT_ANKLE,
];

function landmarkVisibility(frame: Float32Array, idx: number): number {
  return frame[idx * 4 + 3];
}

/** Returns true when key squat landmarks are visible enough for inference. */
export function isPoseQualitySufficient(
  frame: Float32Array,
  config: PoseQualityConfig,
): boolean {
  if (frame.length < 132) return false;
  let sum = 0;
  for (const idx of KEY_LANDMARKS) {
    sum += landmarkVisibility(frame, idx);
  }
  return sum / KEY_LANDMARKS.length >= config.minKeyLandmarkVisibility;
}
