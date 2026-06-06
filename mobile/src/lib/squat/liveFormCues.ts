import { FEEDBACK } from "@/constants/feedbackStrings";
import { meanKneeAngle } from "@/lib/squat/biomechanics";
import { type RepTrackerSnapshot, SquatPhase } from "@/lib/squat/repDetector";
import { getRepTrackingValue } from "@/lib/squat/repMetrics";
import type { RepThresholds } from "@/lib/squat/squatConfig";

export interface LiveCueResult {
  message: string;
  isPositive: boolean;
}

export function getLiveFormCue(
  snapshot: RepTrackerSnapshot,
  rawLandmarks: Float32Array,
  repThresholds: RepThresholds,
): LiveCueResult | null {
  if (!snapshot.isSquatting) return null;

  const depthMetric = getRepTrackingValue(
    rawLandmarks,
    repThresholds.trackingMode,
  );
  const knee = meanKneeAngle(rawLandmarks);

  if (snapshot.phase === SquatPhase.Bottom) {
    if (depthMetric <= repThresholds.adequateDepth) {
      return { message: FEEDBACK.greatDepth, isPositive: true };
    }
    return { message: FEEDBACK.goLower, isPositive: false };
  }

  if (snapshot.phase === SquatPhase.Eccentric) {
    return { message: FEEDBACK.controlDescent, isPositive: false };
  }

  if (snapshot.phase === SquatPhase.Concentric) {
    if (knee < 120) {
      return { message: FEEDBACK.driveUp, isPositive: false };
    }
    return { message: FEEDBACK.chestUp, isPositive: false };
  }

  return null;
}
