import { FEEDBACK } from "@/constants/feedbackStrings";
import type { SquatErrorKey } from "@/lib/squat/constants";

const MODEL_ERROR_FEEDBACK: ReadonlyArray<{
  key: SquatErrorKey;
  message: string;
}> = [
  { key: "knee_valgus", message: FEEDBACK.kneeValgus },
  { key: "insufficient_depth", message: FEEDBACK.insufficientDepth },
  { key: "forward_lean", message: FEEDBACK.forwardLean },
];
import {
  phaseLabel,
  type RepTrackerSnapshot,
  SquatPhase,
} from "@/lib/squat/repDetector";
import {
  getSquatRuntimeConfig,
  type ResolvedViewAngle,
  type SquatRuntimeConfig,
} from "@/lib/squat/squatConfig";
import type {
  SquatInferenceResult,
  SquatPrediction,
} from "@/lib/squat/squatTypes";

export function buildModelFeedback(
  prediction: SquatPrediction,
  config: SquatRuntimeConfig,
): string {
  const t = config.inference.errorThreshold;
  if (prediction.isCorrect) {
    return FEEDBACK.goodForm(Math.round(prediction.confidence * 100));
  }

  const messages: string[] = [];
  for (const { key, message } of MODEL_ERROR_FEEDBACK) {
    if (prediction.errors[key] > t) {
      messages.push(message);
    }
  }

  if (messages.length > 0) {
    return messages.join(". ");
  }

  const ranked = MODEL_ERROR_FEEDBACK.map(({ key, message }) => ({
    message,
    score: prediction.errors[key],
  })).sort((a, b) => b.score - a.score);

  const top = ranked[0];
  if (top && top.score >= 0.2) {
    return `${top.message} (${Math.round(top.score * 100)}%)`;
  }

  return FEEDBACK.formNeedsImprovement(
    Math.round(prediction.incorrectProbability * 100),
  );
}

/** Exported for unit tests. */
export function formatSquatFeedback(
  prediction: SquatPrediction,
  config: SquatRuntimeConfig = getSquatRuntimeConfig(),
): string {
  return buildModelFeedback(prediction, config);
}

export function repCountOnlyFeedback(): string {
  return FEEDBACK.repCountOnly;
}

export interface TrackerFeedbackInput {
  tracker: RepTrackerSnapshot | null;
  result: SquatInferenceResult | null;
  liveCue: string;
  repCountOnlyMode: boolean;
  activeViewAngle: ResolvedViewAngle;
}

/** Status copy while tracking (calibration, phase, between reps). */
export function buildTrackerFeedback(input: TrackerFeedbackInput): string {
  const { tracker, result, liveCue, repCountOnlyMode, activeViewAngle } = input;

  if (repCountOnlyMode && tracker && tracker.repCount > 0) {
    return repCountOnlyFeedback();
  }
  if (liveCue) return liveCue;
  if (result?.feedback) return result.feedback;
  if (!tracker) return "";

  if (!tracker.calibrationRequested) {
    return FEEDBACK.tapToCalibrate;
  }
  if (!tracker.calibrated) {
    return activeViewAngle === "front"
      ? FEEDBACK.calibrateFront
      : FEEDBACK.calibrateSide;
  }
  if (tracker.isSquatting) {
    const phaseMsg =
      tracker.phase === SquatPhase.Bottom
        ? FEEDBACK.goLower
        : tracker.phase === SquatPhase.Concentric
          ? FEEDBACK.chestUp
          : tracker.phase === SquatPhase.Eccentric
            ? FEEDBACK.controlDescent
            : phaseLabel(tracker.phase);
    return `${phaseMsg} (${Math.round(tracker.repProgress * 100)}%)`;
  }
  if (tracker.repCount > 0) {
    return FEEDBACK.repComplete(tracker.repCount);
  }
  if (
    tracker.standingBaseline != null &&
    tracker.standingBaseline - tracker.hipKneeAngle >= 12
  ) {
    return FEEDBACK.descentDetected;
  }
  return FEEDBACK.calibratedReady;
}
