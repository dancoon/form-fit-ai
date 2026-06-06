import scalerJson from "@/assets/models/feature_scaler.json";
import { devWarn } from "@/lib/logging";
import { SQUAT_FEATURES_PER_FRAME } from "@/lib/squat/constants";

export interface FeatureScaler {
  mean: Float32Array;
  scale: Float32Array;
}

function loadScaler(): FeatureScaler {
  const mean = scalerJson.mean ?? [];
  const scale = scalerJson.scale ?? [];

  if (
    mean.length === SQUAT_FEATURES_PER_FRAME &&
    scale.length === SQUAT_FEATURES_PER_FRAME
  ) {
    return {
      mean: new Float32Array(mean),
      scale: new Float32Array(scale),
    };
  }

  devWarn(
    "[squat] feature_scaler.json missing or invalid — using identity normalization. " +
      "Export scaler from the notebook (scripts/export_feature_scaler.py).",
  );
  return {
    mean: new Float32Array(SQUAT_FEATURES_PER_FRAME),
    scale: Float32Array.from({ length: SQUAT_FEATURES_PER_FRAME }, () => 1),
  };
}

export const featureScaler = loadScaler();

/** StandardScaler transform on flattened (frames × 22) features. */
export function normalizeFeatures(flat: Float32Array): Float32Array {
  const out = new Float32Array(flat.length);
  const { mean, scale } = featureScaler;

  for (let i = 0; i < flat.length; i++) {
    const featureIdx = i % SQUAT_FEATURES_PER_FRAME;
    out[i] = (flat[i] - mean[featureIdx]) / scale[featureIdx];
  }

  return out;
}
