/**
 * Squat use case: model inference, depth gate, and rep-level feedback.
 * Orchestrates {@link SquatRepTracker}. See src/lib/squat/README.md and docs/ARCHITECTURE.md.
 */
import type { TfliteModel } from "react-native-fast-tflite";
import { devLog } from "@/lib/logging";
import {
  extractSequenceFeatures,
  meanKneeAngle,
} from "@/lib/squat/biomechanics";
import { SQUAT_SEQUENCE_LENGTH } from "@/lib/squat/constants";
import { normalizeFeatures } from "@/lib/squat/featureScaler";
import { encodeModelInput, parseModelOutputs } from "@/lib/squat/squatModelIO";
import {
  biomechIndicatesIncorrect,
  detectFormErrorsFromRepWindow,
} from "@/lib/squat/formErrorDetection";
import { buildModelFeedback } from "@/lib/squat/squatFeedback";
import {
  type RepTrackerSnapshot,
  SquatRepTracker,
  type SquatRepTrackerOptions,
} from "@/lib/squat/repDetector";
import {
  getSquatRuntimeConfig,
  type SquatRuntimeConfig,
} from "@/lib/squat/squatConfig";
import type {
  SquatInferenceResult,
  SquatPrediction,
} from "@/lib/squat/squatTypes";

export type { SquatInferenceResult, SquatPrediction, RepTrackerSnapshot };

export interface SquatInferencePipelineOptions extends SquatRepTrackerOptions {
  runtimeConfig?: SquatRuntimeConfig;
}

/** Hybrid: rules override pass/fail when they flag an error; otherwise use ML. */
function mergeRulesFirst(
  model: SquatPrediction,
  biomechErrors: SquatPrediction["errors"],
  repWindow: Float32Array[],
  config: SquatRuntimeConfig,
): SquatPrediction {
  if (biomechIndicatesIncorrect(biomechErrors, config)) {
    return {
      ...predictionFromBiomech(biomechErrors, repWindow, config),
      kneeAngle: model.kneeAngle,
    };
  }

  const errors = {
    knee_valgus: Math.max(model.errors.knee_valgus, biomechErrors.knee_valgus),
    insufficient_depth: Math.max(
      model.errors.insufficient_depth,
      biomechErrors.insufficient_depth,
    ),
    forward_lean: Math.max(
      model.errors.forward_lean,
      biomechErrors.forward_lean,
    ),
  };

  return { ...model, errors };
}

function predictionFromBiomech(
  biomechErrors: SquatPrediction["errors"],
  repWindow: Float32Array[],
  config: SquatRuntimeConfig,
): SquatPrediction {
  const incorrect = biomechIndicatesIncorrect(biomechErrors, config);
  const maxError = Math.max(
    biomechErrors.knee_valgus,
    biomechErrors.insufficient_depth,
    biomechErrors.forward_lean,
  );
  const incorrectProbability = incorrect ? Math.max(maxError, 0.55) : maxError;

  return {
    isCorrect: !incorrect,
    confidence: incorrect ? incorrectProbability : 1 - maxError * 0.5,
    incorrectProbability,
    errors: biomechErrors,
    kneeAngle: meanKneeAngle(repWindow[repWindow.length - 1]),
  };
}

export { formatSquatFeedback } from "@/lib/squat/squatFeedback";
export { repCountOnlyFeedback } from "@/lib/squat/squatFeedback";

export class SquatInferencePipeline {
  private config: SquatRuntimeConfig;
  private repTracker: SquatRepTracker;
  private lastSnapshot: RepTrackerSnapshot | null = null;

  constructor(options?: SquatInferencePipelineOptions) {
    this.config = options?.runtimeConfig ?? getSquatRuntimeConfig();
    this.repTracker = new SquatRepTracker({ runtimeConfig: this.config });
  }

  setRuntimeConfig(config: SquatRuntimeConfig): void {
    this.config = config;
    this.repTracker.setRuntimeConfig(config);
  }

  get snapshot(): RepTrackerSnapshot | null {
    return this.lastSnapshot;
  }

  get bufferLength(): number {
    return this.lastSnapshot?.activeRepFrameCount ?? 0;
  }

  get isBufferFull(): boolean {
    return this.lastSnapshot?.repWindowReady ?? false;
  }

  requestCalibration(): void {
    this.repTracker.requestCalibration();
  }

  reset(): void {
    this.repTracker.reset();
    this.lastSnapshot = null;
  }

  notifyPoseLost(): void {
    this.repTracker.notifyPoseLost();
  }

  pushFrame(rawLandmarks: Float32Array): RepTrackerSnapshot {
    this.lastSnapshot = this.repTracker.pushFrame(rawLandmarks);
    return this.lastSnapshot;
  }

  /** Angle / geometry form check — no TFLite required. */
  runBiomechOnRepWindow(
    repWindow: Float32Array[],
    snapshot: RepTrackerSnapshot,
  ): SquatInferenceResult | null {
    if (repWindow.length < SQUAT_SEQUENCE_LENGTH) return null;

    const biomechErrors = detectFormErrorsFromRepWindow(
      repWindow,
      this.config,
    );
    const prediction = predictionFromBiomech(
      biomechErrors,
      repWindow,
      this.config,
    );

    if (__DEV__) {
      devLog(
        `[squat] biomech errors=[${biomechErrors.knee_valgus.toFixed(3)}, ${biomechErrors.insufficient_depth.toFixed(3)}, ${biomechErrors.forward_lean.toFixed(3)}] correct=${prediction.isCorrect}`,
      );
    }

    return {
      ...prediction,
      feedback: buildModelFeedback(prediction, this.config),
      repNumber: snapshot.repCount,
      phase: snapshot.phase,
    };
  }

  async runOnRepWindow(
    model: TfliteModel,
    repWindow: Float32Array[],
    snapshot: RepTrackerSnapshot,
  ): Promise<SquatInferenceResult | null> {
    if (repWindow.length < SQUAT_SEQUENCE_LENGTH) {
      return null;
    }

    if (this.config.formFeedbackSource === "biomech") {
      return this.runBiomechOnRepWindow(repWindow, snapshot);
    }

    const biomechErrors = detectFormErrorsFromRepWindow(
      repWindow,
      this.config,
    );

    const t0 = __DEV__ ? performance.now() : 0;
    const features = extractSequenceFeatures(repWindow);
    const normalized = normalizeFeatures(features);

    const outputs = await model.run([encodeModelInput(model, normalized)]);
    const { classification: clsProb, errors } = parseModelOutputs(
      outputs,
      model.outputs,
    );
    const [err0, err1, err2] = errors;

    if (__DEV__) {
      const ms = performance.now() - t0;
      devLog(
        `[squat] model ${ms.toFixed(1)}ms · cls=${clsProb.toFixed(3)} model=[${err0.toFixed(3)}, ${err1.toFixed(3)}, ${err2.toFixed(3)}] biomech=[${biomechErrors.knee_valgus.toFixed(3)}, ${biomechErrors.insufficient_depth.toFixed(3)}, ${biomechErrors.forward_lean.toFixed(3)}]`,
      );
    }

    const clsThreshold = this.config.inference.classificationThreshold;
    const isCorrect = clsProb < clsThreshold;
    const confidence = isCorrect ? 1 - clsProb : clsProb;
    const latestFrame = repWindow[repWindow.length - 1];

    const modelPrediction: SquatPrediction = {
      isCorrect,
      confidence,
      incorrectProbability: clsProb,
      errors: {
        knee_valgus: err0,
        insufficient_depth: err1,
        forward_lean: err2,
      },
      kneeAngle: meanKneeAngle(latestFrame),
    };

    const prediction =
      this.config.formFeedbackSource === "hybrid"
        ? mergeRulesFirst(
            modelPrediction,
            biomechErrors,
            repWindow,
            this.config,
          )
        : modelPrediction;

    return {
      ...prediction,
      feedback: buildModelFeedback(prediction, this.config),
      repNumber: snapshot.repCount,
      phase: snapshot.phase,
    };
  }

  takeCompletedRepWindow(): Float32Array[] | null {
    return this.repTracker.consumeRepWindow();
  }
}

export { SquatPhase, phaseLabel } from "@/lib/squat/repDetector";

export function predictionToSeverity(
  prediction: SquatPrediction,
): Float32Array {
  const data = new Float32Array(4);
  data[0] = prediction.incorrectProbability;
  data[1] = prediction.errors.knee_valgus;
  data[2] = prediction.errors.insufficient_depth;
  data[3] = prediction.errors.forward_lean;
  return data;
}

export function predictionToUiSeverity(
  prediction: SquatPrediction,
  config: SquatRuntimeConfig = getSquatRuntimeConfig(),
): number {
  if (prediction.isCorrect) return 0;
  const t = config.inference.errorThreshold;
  return Math.max(
    prediction.incorrectProbability,
    prediction.errors.knee_valgus > t ? prediction.errors.knee_valgus : 0,
    prediction.errors.insufficient_depth > t
      ? prediction.errors.insufficient_depth
      : 0,
    prediction.errors.forward_lean > t ? prediction.errors.forward_lean : 0,
  );
}
