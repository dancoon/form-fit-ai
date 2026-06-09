/** Matches notebook `Config` for the squat form model. */
export const SQUAT_SEQUENCE_LENGTH = 30;
export const SQUAT_FEATURES_PER_FRAME = 22;
export const SQUAT_RAW_LANDMARK_DIM = 33 * 4; // x, y, z, visibility per landmark

export const SQUAT_ERROR_LABELS = [
  "knee_valgus",
  "insufficient_depth",
  "forward_lean",
] as const;

export type SquatErrorKey = (typeof SQUAT_ERROR_LABELS)[number];
