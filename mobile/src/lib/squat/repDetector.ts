/**
 * Squat rep finite-state machine: phases, counting, and rep window for the model.
 * See src/lib/squat/README.md.
 */
import { meanKneeAngle, meanShoulderY } from "@/lib/squat/biomechanics";
import { copyRawLandmarksFrame } from "@/lib/squat/rawLandmarks";
import { SQUAT_SEQUENCE_LENGTH } from "@/lib/squat/constants";
import { getRepTrackingValue } from "@/lib/squat/repMetrics";
import {
  getSquatRuntimeConfig,
  type RepThresholds,
  type SquatRuntimeConfig,
} from "@/lib/squat/squatConfig";

export enum SquatPhase {
  Standing = "standing",
  Eccentric = "eccentric",
  Bottom = "bottom",
  Concentric = "concentric",
}

export interface RepTrackerSnapshot {
  phase: SquatPhase;
  repCount: number;
  kneeAngle: number;
  /** Primary rep-tracking metric (thigh ° side, knee ° front). */
  hipKneeAngle: number;
  viewAngle: "side" | "front";
  shoulderY: number;
  smoothedShoulderY: number;
  standingBaseline: number | null;
  calibrated: boolean;
  calibrationRequested: boolean;
  isSquatting: boolean;
  repProgress: number;
  activeRepFrameCount: number;
  repCompleted: boolean;
  repWindowReady: boolean;
  repWindow: Float32Array[] | null;
  repMinHipKneeAngle: number | null;
}

export interface SquatRepTrackerOptions {
  runtimeConfig?: SquatRuntimeConfig;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resampleSequence(
  sequence: Float32Array[],
  targetLength: number,
): Float32Array[] {
  if (sequence.length === 0) return [];
  if (sequence.length === targetLength) return [...sequence];
  if (sequence.length === 1) {
    return Array.from({ length: targetLength }, () => sequence[0]);
  }

  const featureDim = sequence[0].length;
  const out: Float32Array[] = [];

  for (let i = 0; i < targetLength; i++) {
    const t = (i / (targetLength - 1)) * (sequence.length - 1);
    const lower = Math.floor(t);
    const upper = Math.min(lower + 1, sequence.length - 1);
    const alpha = t - lower;
    const frame = new Float32Array(featureDim);

    for (let j = 0; j < featureDim; j++) {
      frame[j] = (1 - alpha) * sequence[lower][j] + alpha * sequence[upper][j];
    }
    out.push(frame);
  }

  return out;
}

type SquatStage = "up" | "down";

export class SquatRepTracker {
  private config: SquatRuntimeConfig;
  private phase = SquatPhase.Standing;
  private stage: SquatStage = "up";
  private repCount = 0;
  private smoothedPrimary: number | null = null;
  private prevSmoothedPrimary: number | null = null;
  private standingBaseline: number | null = null;
  private calibrationSamples: number[] = [];
  private calibrated = false;
  private calibrationRequested = false;

  private repMinPrimary = Number.POSITIVE_INFINITY;
  private activeRepFrames: Float32Array[] = [];
  private sawBottom = false;
  private poseLostFrames = 0;

  private repCompleted = false;
  private repWindowReady = false;
  private repWindow: Float32Array[] | null = null;
  private lastRepMinPrimary: number | null = null;

  constructor(options?: SquatRepTrackerOptions) {
    this.config = options?.runtimeConfig ?? getSquatRuntimeConfig();
  }

  setRuntimeConfig(config: SquatRuntimeConfig): void {
    this.config = config;
  }

  requestCalibration(): void {
    this.calibrationRequested = true;
    this.calibrationSamples = [];
    this.calibrated = false;
    this.standingBaseline = null;
  }

  reset(): void {
    this.phase = SquatPhase.Standing;
    this.stage = "up";
    this.repCount = 0;
    this.smoothedPrimary = null;
    this.prevSmoothedPrimary = null;
    this.standingBaseline = null;
    this.calibrationSamples = [];
    this.calibrated = false;
    this.calibrationRequested = false;
    this.repMinPrimary = Number.POSITIVE_INFINITY;
    this.activeRepFrames = [];
    this.sawBottom = false;
    this.poseLostFrames = 0;
    this.repCompleted = false;
    this.repWindowReady = false;
    this.repWindow = null;
    this.lastRepMinPrimary = null;
  }

  private rep(): RepThresholds {
    return this.config.rep;
  }

  private trackingMode() {
    return this.rep().trackingMode;
  }

  private primaryValue(frame: Float32Array): number {
    return getRepTrackingValue(frame, this.trackingMode());
  }

  private descentFromStand(rawPrimary: number): number {
    const stand = this.standingBaseline ?? rawPrimary;
    return stand - rawPrimary;
  }

  private shouldStartRep(rawPrimary: number): boolean {
    const r = this.rep();
    if (rawPrimary < r.downAngle) return true;
    if (!this.standingBaseline) return false;
    return this.descentFromStand(rawPrimary) >= r.minDescentFromStand;
  }

  private shouldEndRep(rawPrimary: number): boolean {
    const r = this.rep();
    if (!this.sawBottom) return false;
    if (rawPrimary >= r.upAngle) return true;
    if (this.standingBaseline != null) {
      return this.descentFromStand(rawPrimary) <= r.endDescentMargin;
    }
    return false;
  }

  private atBottom(rawPrimary: number): boolean {
    const r = this.rep();
    if (rawPrimary <= r.adequateDepth) return true;
    if (!this.standingBaseline) return false;
    return this.descentFromStand(rawPrimary) >= r.minDescentFromStand * 0.85;
  }

  private observeStanding(primary: number, legAngle: number): void {
    const r = this.rep();
    if (legAngle < r.standingLegMin || legAngle > r.standingLegMax) return;
    this.calibrationSamples.push(primary);
    if (this.calibrationSamples.length > r.calibrationFrames * 2) {
      this.calibrationSamples.shift();
    }

    if (this.calibrationSamples.length >= r.calibrationFrames) {
      const sorted = [...this.calibrationSamples].sort((a, b) => a - b);
      const highCount = Math.max(3, Math.floor(sorted.length * 0.35));
      const high = sorted.slice(-highCount);
      this.standingBaseline = high.reduce((sum, v) => sum + v, 0) / high.length;
      this.calibrated = true;
    }
  }

  private cancelActiveRep(): void {
    this.stage = "up";
    this.phase = SquatPhase.Standing;
    this.activeRepFrames = [];
    this.sawBottom = false;
    this.repMinPrimary = Number.POSITIVE_INFINITY;
    this.poseLostFrames = 0;
  }

  private startRep(): void {
    this.activeRepFrames = [];
    this.repMinPrimary = Number.POSITIVE_INFINITY;
    this.sawBottom = false;
    this.repCompleted = false;
    this.repWindowReady = false;
    this.repWindow = null;
    this.poseLostFrames = 0;
    this.phase = SquatPhase.Eccentric;
  }

  private finishRep(): void {
    const r = this.rep();
    if (this.activeRepFrames.length >= r.minRepFrames && this.sawBottom) {
      this.repCount += 1;
      this.repWindow = resampleSequence(
        this.activeRepFrames,
        SQUAT_SEQUENCE_LENGTH,
      );
      this.repWindowReady = true;
      this.repCompleted = true;
      this.lastRepMinPrimary = this.repMinPrimary;
    }

    this.stage = "up";
    this.phase = SquatPhase.Standing;
    this.activeRepFrames = [];
    this.sawBottom = false;
    this.poseLostFrames = 0;
  }

  private updatePhase(rawPrimary: number, primaryDelta: number): void {
    if (this.stage === "up") {
      this.phase = SquatPhase.Standing;
      return;
    }

    if (this.atBottom(rawPrimary)) {
      this.phase = SquatPhase.Bottom;
      return;
    }

    if (this.sawBottom || primaryDelta > 0.4) {
      this.phase = SquatPhase.Concentric;
      return;
    }

    this.phase = SquatPhase.Eccentric;
  }

  notifyPoseLost(): RepTrackerSnapshot | null {
    if (this.stage !== "down") return null;
    this.poseLostFrames += 1;
    if (this.poseLostFrames >= this.rep().poseLostCancelFrames) {
      this.cancelActiveRep();
    }
    return null;
  }

  pushFrame(rawLandmarks: Float32Array): RepTrackerSnapshot {
    this.poseLostFrames = 0;

    const { thighSmoothAlpha, downAngle } = this.rep();
    const kneeAngle = meanKneeAngle(rawLandmarks);
    const rawPrimary = this.primaryValue(rawLandmarks);
    const shoulderY = meanShoulderY(rawLandmarks);

    if (this.smoothedPrimary == null) {
      this.smoothedPrimary = rawPrimary;
      this.prevSmoothedPrimary = rawPrimary;
    } else {
      this.prevSmoothedPrimary = this.smoothedPrimary;
      this.smoothedPrimary =
        thighSmoothAlpha * rawPrimary +
        (1 - thighSmoothAlpha) * this.smoothedPrimary;
    }

    const primaryDelta =
      this.smoothedPrimary - (this.prevSmoothedPrimary ?? rawPrimary);
    const smoothed = this.smoothedPrimary;

    if (!this.calibrated && this.calibrationRequested) {
      this.observeStanding(rawPrimary, kneeAngle);
    }

    if (this.calibrated) {
      if (this.stage === "up") {
        if (this.shouldStartRep(rawPrimary)) {
          this.stage = "down";
          this.startRep();
          this.activeRepFrames.push(copyRawLandmarksFrame(rawLandmarks));
          this.repMinPrimary = rawPrimary;
          this.sawBottom = this.atBottom(rawPrimary);
        }
      } else {
        this.activeRepFrames.push(copyRawLandmarksFrame(rawLandmarks));
        this.repMinPrimary = Math.min(this.repMinPrimary, rawPrimary);

        if (this.atBottom(rawPrimary)) {
          this.sawBottom = true;
        }

        if (this.shouldEndRep(rawPrimary)) {
          this.finishRep();
        }
      }

      this.updatePhase(rawPrimary, primaryDelta);
    }

    const isSquatting = this.stage === "down";
    const repProgress = (() => {
      if (!isSquatting) return 0;
      const stand = this.standingBaseline ?? downAngle + 25;
      const rom = Math.max(stand - downAngle, 15);
      const depth = clamp((stand - smoothed) / rom, 0, 1);

      if (this.phase === SquatPhase.Concentric) {
        return clamp(0.55 + depth * 0.45, 0.55, 1);
      }
      if (this.phase === SquatPhase.Bottom) return 1;
      return depth * 0.9;
    })();

    return {
      phase: this.phase,
      repCount: this.repCount,
      kneeAngle,
      hipKneeAngle: rawPrimary,
      viewAngle: this.config.viewAngle,
      shoulderY,
      smoothedShoulderY: shoulderY,
      standingBaseline: this.standingBaseline,
      calibrated: this.calibrated,
      calibrationRequested: this.calibrationRequested,
      isSquatting,
      repProgress,
      activeRepFrameCount: this.activeRepFrames.length,
      repCompleted: this.repCompleted,
      repWindowReady: this.repWindowReady,
      repWindow: this.repWindow,
      repMinHipKneeAngle: isSquatting
        ? this.repMinPrimary
        : this.lastRepMinPrimary,
    };
  }

  consumeRepWindow(): Float32Array[] | null {
    const window = this.repWindow;
    this.repWindow = null;
    this.repCompleted = false;
    this.repWindowReady = false;
    return window;
  }
}

export function phaseLabel(phase: SquatPhase): string {
  switch (phase) {
    case SquatPhase.Standing:
      return "Standing";
    case SquatPhase.Eccentric:
      return "Descending";
    case SquatPhase.Bottom:
      return "Bottom";
    case SquatPhase.Concentric:
      return "Rising";
  }
}

export { isDepthAdequateInWindow } from "@/lib/squat/repMetrics";
