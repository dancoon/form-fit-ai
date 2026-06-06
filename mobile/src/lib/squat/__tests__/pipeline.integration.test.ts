import { describe, expect, test } from "bun:test";
import type { TfliteModel } from "react-native-fast-tflite";
import { SQUAT_SEQUENCE_LENGTH } from "@/lib/squat/constants";
import { LM } from "@/lib/squat/landmarkIndices";
import { SquatPhase } from "@/lib/squat/repDetector";
import { SquatInferencePipeline } from "@/lib/squat/squatInference";

function setLm(
  frame: Float32Array,
  idx: number,
  x: number,
  y: number,
): void {
  const b = idx * 4;
  frame[b] = x;
  frame[b + 1] = y;
}

function standingFrame(): Float32Array {
  const f = new Float32Array(33 * 4);
  setLm(f, LM.LEFT_SHOULDER, 0.55, 0.28);
  setLm(f, LM.RIGHT_SHOULDER, 0.45, 0.28);
  setLm(f, LM.LEFT_HIP, 0.54, 0.52);
  setLm(f, LM.RIGHT_HIP, 0.46, 0.52);
  setLm(f, LM.LEFT_KNEE, 0.55, 0.72);
  setLm(f, LM.RIGHT_KNEE, 0.45, 0.72);
  setLm(f, LM.LEFT_ANKLE, 0.55, 0.92);
  setLm(f, LM.RIGHT_ANKLE, 0.45, 0.92);
  return f;
}

function createMockTfliteModel(
  classification = 0.05,
  errors: [number, number, number] = [0.1, 0.1, 0.1],
): TfliteModel {
  const elementCount = 4;
  return {
    inputs: [{ shape: [1, SQUAT_SEQUENCE_LENGTH, 22], dataType: "float32" }],
    outputs: [{ shape: [1, elementCount], dataType: "float32" }],
    run: async () => {
      const buffer = new ArrayBuffer(elementCount * 4);
      const view = new Float32Array(buffer);
      view[0] = classification;
      view[1] = errors[0];
      view[2] = errors[1];
      view[3] = errors[2];
      return [buffer];
    },
  } as TfliteModel;
}

describe("SquatInferencePipeline integration", () => {
  test("runOnRepWindow returns feedback for valid window", async () => {
    const pipeline = new SquatInferencePipeline();
    const frame = standingFrame();
    const repWindow = Array.from({ length: SQUAT_SEQUENCE_LENGTH }, () => frame);
    const snapshot = {
      phase: SquatPhase.Concentric,
      repCount: 1,
      kneeAngle: 120,
      hipKneeAngle: 110,
      viewAngle: "side" as const,
      shoulderY: 0.3,
      smoothedShoulderY: 0.3,
      standingBaseline: 170,
      calibrated: true,
      calibrationRequested: true,
      isSquatting: false,
      repProgress: 1,
      activeRepFrameCount: SQUAT_SEQUENCE_LENGTH,
      repCompleted: true,
      repWindowReady: true,
      repWindow,
      repMinHipKneeAngle: 95,
    };

    const result = await pipeline.runOnRepWindow(
      createMockTfliteModel(0.05),
      repWindow,
      snapshot,
    );

    expect(result).not.toBeNull();
    expect(result?.isCorrect).toBe(true);
    expect(result?.feedback.length).toBeGreaterThan(0);
    expect(result?.repNumber).toBe(1);
  });

  test("returns null when window shorter than sequence length", async () => {
    const pipeline = new SquatInferencePipeline();
    const result = await pipeline.runOnRepWindow(
      createMockTfliteModel(),
      [standingFrame()],
      {
        phase: SquatPhase.Standing,
        repCount: 0,
        kneeAngle: 170,
        hipKneeAngle: 170,
        viewAngle: "side",
        shoulderY: 0.3,
        smoothedShoulderY: 0.3,
        standingBaseline: null,
        calibrated: false,
        calibrationRequested: false,
        isSquatting: false,
        repProgress: 0,
        activeRepFrameCount: 1,
        repCompleted: false,
        repWindowReady: false,
        repWindow: null,
        repMinHipKneeAngle: null,
      },
    );
    expect(result).toBeNull();
  });
});
