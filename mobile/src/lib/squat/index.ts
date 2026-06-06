/**
 * Public squat domain API. Prefer importing from here in app/hooks code.
 */
export { SQUAT_SEQUENCE_LENGTH, type SquatErrorKey } from "@/lib/squat/constants";
export {
  formatSquatFeedback,
  buildTrackerFeedback,
  repCountOnlyFeedback,
} from "@/lib/squat/squatFeedback";
export { loadSquatModel } from "@/lib/squat/loadSquatModel";
export {
  SquatPhase,
  SquatRepTracker,
  phaseLabel,
  type RepTrackerSnapshot,
} from "@/lib/squat/repDetector";
export {
  getSquatRuntimeConfig,
  type CameraAnglePreset,
  type CameraFacing,
  type PoseModelQuality,
  type ResolvedViewAngle,
  type SensitivityPreset,
  type SquatRuntimeConfig,
} from "@/lib/squat/squatConfig";
export {
  SquatInferencePipeline,
  predictionToSeverity,
  predictionToUiSeverity,
} from "@/lib/squat/squatInference";
export type {
  SquatInferenceResult,
  SquatPrediction,
} from "@/lib/squat/squatTypes";
export { inferViewAngle, resolveViewAngle } from "@/lib/squat/repMetrics";
export { ViewAngleVoter } from "@/lib/squat/viewAngleVoting";
export {
  hasTrackerUiChanged,
  trackerUiFingerprint,
} from "@/lib/squat/trackerUi";
