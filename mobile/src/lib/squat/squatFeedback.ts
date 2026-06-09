import { FEEDBACK } from "@/constants/feedbackStrings";
import type { SquatErrorKey } from "@/lib/squat/constants";
import {
  type RepTrackerSnapshot,
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

const MODEL_ERROR_FEEDBACK: ReadonlyArray<{
  key: SquatErrorKey;
  message: string;
}> = [
  { key: "knee_valgus", message: FEEDBACK.kneeValgus },
  { key: "insufficient_depth", message: FEEDBACK.insufficientDepth },
  { key: "forward_lean", message: FEEDBACK.forwardLean },
];

function isDescentStarting(tracker: RepTrackerSnapshot): boolean {
  return (
    !tracker.isSquatting &&
    tracker.standingBaseline != null &&
    tracker.standingBaseline - tracker.hipKneeAngle >= 12
  );
}

export function buildModelFeedback(
  prediction: SquatPrediction,
  config: SquatRuntimeConfig,
): string {
  const t = config.inference.errorThreshold;
  if (prediction.isCorrect) {
    return FEEDBACK.goodForm;
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
    return top.message;
  }

  return FEEDBACK.formNeedsImprovement;
}

/** Exported for unit tests. */
export function formatSquatFeedback(
  prediction: SquatPrediction,
  config: SquatRuntimeConfig = getSquatRuntimeConfig(),
): string {
  return buildModelFeedback(prediction, config);
}

/** Dev-only: model error head scores as a single line. */
export function formatDevErrorScores(
  errors: Record<SquatErrorKey, number>,
): string {
  return `Valgus ${Math.round(errors.knee_valgus * 100)}% · Depth ${Math.round(errors.insufficient_depth * 100)}% · Lean ${Math.round(errors.forward_lean * 100)}%`;
}

/** User-facing issue copy from stored per-rep error scores (e.g. workout summary). */
export function feedbackFromRepErrors(
  errors: Record<SquatErrorKey, number>,
  config: SquatRuntimeConfig = getSquatRuntimeConfig(),
): string {
  return buildModelFeedback(
    {
      isCorrect: false,
      confidence: 0,
      incorrectProbability: 0.5,
      errors,
      kneeAngle: 0,
    },
    config,
  );
}

export function repCountOnlyFeedback(): string {
  return FEEDBACK.repCountOnly;
}

export interface TrackerFeedbackInput {
  tracker: RepTrackerSnapshot | null;
  result: SquatInferenceResult | null;
  repCountOnlyMode: boolean;
  activeViewAngle: ResolvedViewAngle;
}

/** On-screen status copy (calibration + model result; minimal during the rep). */
export function buildTrackerFeedback(input: TrackerFeedbackInput): string {
  const { tracker, result, repCountOnlyMode, activeViewAngle } = input;

  if (result?.feedback) return result.feedback;
  if (repCountOnlyMode && tracker && tracker.repCount > 0) {
    return repCountOnlyFeedback();
  }
  if (!tracker) return "";

  if (!tracker.calibrationRequested) {
    return FEEDBACK.holdStillToCalibrate;
  }
  if (!tracker.calibrated) {
    return activeViewAngle === "front"
      ? FEEDBACK.calibrateFront
      : FEEDBACK.calibrateSide;
  }
  if (tracker.isSquatting) return "";
  if (isDescentStarting(tracker)) return FEEDBACK.nextRep;
  if (tracker.repCount === 0) return FEEDBACK.calibratedReady;
  return "";
}

/**
 * TTS-only copy — kept minimal during sets:
 * calibration + ready once, form corrections after a rep (no praise, no "next rep").
 */
export function buildVocalFeedback(input: TrackerFeedbackInput): string {
  const { tracker, result, repCountOnlyMode, activeViewAngle } = input;
  if (!tracker) return "";

  if (tracker.isSquatting) return "";

  if (result?.feedback && !result.isCorrect) return result.feedback;

  if (repCountOnlyMode && tracker.repCount > 0) {
    return repCountOnlyFeedback();
  }

  if (!tracker.calibrationRequested) {
    return FEEDBACK.holdStillToCalibrate;
  }
  if (!tracker.calibrated) {
    return activeViewAngle === "front"
      ? FEEDBACK.calibrateFront
      : FEEDBACK.calibrateSide;
  }
  if (tracker.repCount === 0) return FEEDBACK.calibratedReady;
  return "";
}
