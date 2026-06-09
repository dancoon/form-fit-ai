/**
 * Rule-based squat form errors from joint angles and landmark geometry.
 * Used when the TFLite model is unavailable and to corroborate model output.
 */
import {
  kneeValgusOffsets,
  torsoInclinationDeg,
} from "@/lib/squat/biomechanics";
import type { SquatErrorKey } from "@/lib/squat/constants";
import { getRepTrackingValue } from "@/lib/squat/repMetrics";
import type { SquatRuntimeConfig } from "@/lib/squat/squatConfig";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function severityAbove(
  value: number,
  threshold: number,
  range: number,
): number {
  if (range <= 0) return value > threshold ? 1 : 0;
  return clamp01((value - threshold) / range);
}

/** Frames in the deepest portion of the rep (where form faults are most visible). */
export function selectDeepestFrames(
  repWindow: Float32Array[],
  config: SquatRuntimeConfig,
  bottomFraction = 0.35,
): Float32Array[] {
  if (repWindow.length === 0) return [];
  const mode = config.rep.trackingMode;
  const metrics = repWindow.map((f) => getRepTrackingValue(f, mode));
  const minMetric = Math.min(...metrics);
  const maxMetric = Math.max(...metrics);
  const span = maxMetric - minMetric;
  if (span < 4) return repWindow;

  const cutoff = minMetric + span * bottomFraction;
  const deepest = repWindow.filter((_, i) => metrics[i] <= cutoff);
  return deepest.length > 0 ? deepest : repWindow;
}

function depthErrorScore(
  repWindow: Float32Array[],
  config: SquatRuntimeConfig,
): number {
  const mode = config.rep.trackingMode;
  const { adequateDepth } = config.rep;
  const { depthSeverityRangeDeg } = config.biomech;

  let minMetric = Number.POSITIVE_INFINITY;
  for (const frame of repWindow) {
    minMetric = Math.min(minMetric, getRepTrackingValue(frame, mode));
  }

  if (minMetric <= adequateDepth) return 0;
  return severityAbove(
    minMetric,
    adequateDepth,
    depthSeverityRangeDeg,
  );
}

function forwardLeanErrorScore(
  deepestFrames: Float32Array[],
  config: SquatRuntimeConfig,
): number {
  if (deepestFrames.length === 0) return 0;

  const { maxTorsoInclinationDeg, forwardLeanSeverityRangeDeg } = config.biomech;
  let peakTorso = 0;
  for (const frame of deepestFrames) {
    peakTorso = Math.max(peakTorso, torsoInclinationDeg(frame));
  }

  return severityAbove(
    peakTorso,
    maxTorsoInclinationDeg,
    forwardLeanSeverityRangeDeg,
  );
}

function kneeValgusErrorScore(
  deepestFrames: Float32Array[],
  config: SquatRuntimeConfig,
): number {
  if (config.viewAngle !== "front" || deepestFrames.length === 0) return 0;

  const { maxKneeValgusOffset, kneeValgusSeverityRange } = config.biomech;
  let peakOffset = 0;
  for (const frame of deepestFrames) {
    const { left, right } = kneeValgusOffsets(frame);
    peakOffset = Math.max(peakOffset, left, right);
  }

  return severityAbove(
    peakOffset,
    maxKneeValgusOffset,
    kneeValgusSeverityRange,
  );
}

/** Per-error scores in [0, 1] from angle / geometry on a completed rep window. */
export function detectFormErrorsFromRepWindow(
  repWindow: Float32Array[],
  config: SquatRuntimeConfig,
): Record<SquatErrorKey, number> {
  if (repWindow.length === 0) {
    return {
      knee_valgus: 0,
      insufficient_depth: 0,
      forward_lean: 0,
    };
  }

  const deepest = selectDeepestFrames(repWindow, config);

  return {
    knee_valgus: kneeValgusErrorScore(deepest, config),
    insufficient_depth: depthErrorScore(repWindow, config),
    forward_lean: forwardLeanErrorScore(deepest, config),
  };
}

export function biomechIndicatesIncorrect(
  errors: Record<SquatErrorKey, number>,
  config: SquatRuntimeConfig,
): boolean {
  const t = config.inference.errorThreshold;
  return (
    errors.knee_valgus > t ||
    errors.insufficient_depth > t ||
    errors.forward_lean > t
  );
}
