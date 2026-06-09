/** Central thresholds and presets for squat rep detection and model inference. */

export type CameraFacing = "front" | "back";
export type CameraAnglePreset = "auto" | "side" | "front";
export type ResolvedViewAngle = "side" | "front";
export type RepTrackingMode = "thigh_min" | "knee_mean" | "knee_min";
export type SensitivityPreset = "beginner" | "normal" | "strict";
export type PoseModelQuality = "lite" | "full";

/**
 * How rep-level form feedback is produced.
 * - biomech: angle/geometry rules only
 * - hybrid: rules win when they flag an error; otherwise ML classification
 * - model: TFLite only
 */
export type FormFeedbackSource = "biomech" | "hybrid" | "model";

export interface RepThresholds {
  trackingMode: RepTrackingMode;
  /** Primary metric threshold — below = in rep (thigh ° side, knee ° front). */
  downAngle: number;
  /** Primary metric threshold — above = rep complete. */
  upAngle: number;
  /** Primary metric at adequate depth (same units as downAngle). */
  adequateDepth: number;
  calibrationFrames: number;
  /** Consecutive stable standing frames before auto-requesting calibration. */
  autoCalibrationStabilityFrames: number;
  /** Max primary-metric change (°) per frame while waiting to auto-calibrate. */
  autoCalibrationMaxPrimaryDelta: number;
  thighSmoothAlpha: number;
  standingLegMin: number;
  standingLegMax: number;
  minRepFrames: number;
  poseLostCancelFrames: number;
  /** Degrees thigh drops from calibrated stand before a rep starts. */
  minDescentFromStand: number;
  /** Degrees from stand — rep ends when descent falls below this. */
  endDescentMargin: number;
}

export interface InferenceThresholds {
  errorThreshold: number;
  classificationThreshold: number;
  depthGateSuppressedScore: number;
}

export interface PoseQualityConfig {
  minKeyLandmarkVisibility: number;
}

/** Angle / geometry thresholds for rule-based form error detection. */
export interface BiomechErrorThresholds {
  /** Max torso inclination (° from vertical) at bottom before forward-lean score rises. */
  maxTorsoInclinationDeg: number;
  /** Degrees over which torso inclination maps to score 0→1 above the max. */
  forwardLeanSeverityRangeDeg: number;
  /** Knee medial to ankle (norm. x) before valgus score rises (front view). */
  maxKneeValgusOffset: number;
  /** Norm. x span mapping valgus offset to score 0→1 above the max. */
  kneeValgusSeverityRange: number;
  /** Degrees above adequateDepth before insufficient-depth score reaches 1. */
  depthSeverityRangeDeg: number;
}

export interface SquatRuntimeConfig {
  viewAngle: ResolvedViewAngle;
  rep: RepThresholds;
  inference: InferenceThresholds;
  biomech: BiomechErrorThresholds;
  formFeedbackSource: FormFeedbackSource;
  pose: PoseQualityConfig;
}

const SIDE_REP: RepThresholds = {
  // Side/profile: knee flexion (matches notebook RepDetector ~160° stand / ~90° deep).
  // Hip→knee segment angle is unreliable in 2D profile (reads ~170° standing).
  trackingMode: "knee_min",
  downAngle: 115,
  upAngle: 150,
  adequateDepth: 95,
  calibrationFrames: 10,
  autoCalibrationStabilityFrames: 12,
  autoCalibrationMaxPrimaryDelta: 2.5,
  thighSmoothAlpha: 0.6,
  standingLegMin: 167,
  standingLegMax: 180,
  minRepFrames: 12,
  poseLostCancelFrames: 18,
  minDescentFromStand: 22,
  endDescentMargin: 10,
};

const FRONT_REP: RepThresholds = {
  trackingMode: "knee_mean",
  downAngle: 115,
  upAngle: 150,
  adequateDepth: 95,
  calibrationFrames: 10,
  autoCalibrationStabilityFrames: 12,
  autoCalibrationMaxPrimaryDelta: 2.5,
  thighSmoothAlpha: 0.6,
  standingLegMin: 160,
  standingLegMax: 180,
  minRepFrames: 12,
  poseLostCancelFrames: 18,
  minDescentFromStand: 22,
  endDescentMargin: 10,
};

// Torso inclination: warning at maxTorsoInclinationDeg, severity 1 at max + forwardLeanSeverityRangeDeg.
// ~20–30° acceptable at bottom; >40° noticeable; calibrate further against annotated validation set.
const SENSITIVITY_BIOMECH: Record<SensitivityPreset, BiomechErrorThresholds> = {
  beginner: {
    maxTorsoInclinationDeg: 35,
    forwardLeanSeverityRangeDeg: 15,
    maxKneeValgusOffset: 0.055,
    kneeValgusSeverityRange: 0.05,
    depthSeverityRangeDeg: 22,
  },
  normal: {
    maxTorsoInclinationDeg: 30,
    forwardLeanSeverityRangeDeg: 15,
    maxKneeValgusOffset: 0.04,
    kneeValgusSeverityRange: 0.04,
    depthSeverityRangeDeg: 18,
  },
  strict: {
    maxTorsoInclinationDeg: 25,
    forwardLeanSeverityRangeDeg: 12,
    maxKneeValgusOffset: 0.03,
    kneeValgusSeverityRange: 0.035,
    depthSeverityRangeDeg: 14,
  },
};

const SENSITIVITY_INFERENCE: Record<SensitivityPreset, InferenceThresholds> = {
  beginner: {
    errorThreshold: 0.62,
    classificationThreshold: 0.55,
    depthGateSuppressedScore: 0.25,
  },
  normal: {
    errorThreshold: 0.5,
    classificationThreshold: 0.5,
    depthGateSuppressedScore: 0.25,
  },
  strict: {
    errorThreshold: 0.4,
    classificationThreshold: 0.45,
    depthGateSuppressedScore: 0.35,
  },
};

export function getRepThresholds(
  anglePreset: ResolvedViewAngle = "side",
): RepThresholds {
  return anglePreset === "front" ? FRONT_REP : SIDE_REP;
}

export function getSquatRuntimeConfig(options?: {
  anglePreset?: ResolvedViewAngle;
  sensitivity?: SensitivityPreset;
  formFeedbackSource?: FormFeedbackSource;
}): SquatRuntimeConfig {
  const viewAngle = options?.anglePreset ?? "side";
  const sensitivity = options?.sensitivity ?? "normal";
  return {
    viewAngle,
    rep: getRepThresholds(viewAngle),
    inference: SENSITIVITY_INFERENCE[sensitivity],
    biomech: SENSITIVITY_BIOMECH[sensitivity],
    formFeedbackSource: options?.formFeedbackSource ?? "hybrid",
    pose: { minKeyLandmarkVisibility: 0.45 },
  };
}

export function getPoseModelAsset(_quality: PoseModelQuality = "lite"): string {
  // Full model asset not bundled yet — lite only until pose_landmarker_full.task is added.
  return "pose_landmarker_lite.task";
}
