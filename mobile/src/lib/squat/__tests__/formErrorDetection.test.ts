import { describe, expect, test } from "bun:test";
import { SQUAT_RAW_LANDMARK_DIM } from "@/lib/squat/constants";
import { detectFormErrorsFromRepWindow } from "@/lib/squat/formErrorDetection";
import { LM } from "@/lib/squat/landmarkIndices";
import { getSquatRuntimeConfig } from "@/lib/squat/squatConfig";

function setLm(
  frame: Float32Array,
  idx: number,
  x: number,
  y: number,
  z = 0,
): void {
  const b = idx * 4;
  frame[b] = x;
  frame[b + 1] = y;
  frame[b + 2] = z;
  frame[b + 3] = 0.95;
}

function frontStandingFrame(): Float32Array {
  const f = new Float32Array(SQUAT_RAW_LANDMARK_DIM);
  setLm(f, LM.LEFT_SHOULDER, 0.38, 0.22);
  setLm(f, LM.RIGHT_SHOULDER, 0.62, 0.22);
  setLm(f, LM.LEFT_HIP, 0.42, 0.44);
  setLm(f, LM.RIGHT_HIP, 0.58, 0.44);
  setLm(f, LM.LEFT_KNEE, 0.4, 0.7);
  setLm(f, LM.RIGHT_KNEE, 0.6, 0.7);
  setLm(f, LM.LEFT_ANKLE, 0.4, 0.92);
  setLm(f, LM.RIGHT_ANKLE, 0.6, 0.92);
  return f;
}

function frontDeepGoodFrame(): Float32Array {
  const f = frontStandingFrame();
  setLm(f, LM.LEFT_HIP, 0.4, 0.64);
  setLm(f, LM.RIGHT_HIP, 0.6, 0.64);
  setLm(f, LM.LEFT_KNEE, 0.32, 0.76);
  setLm(f, LM.RIGHT_KNEE, 0.68, 0.76);
  setLm(f, LM.LEFT_ANKLE, 0.3, 0.92);
  setLm(f, LM.RIGHT_ANKLE, 0.7, 0.92);
  return f;
}

function repWindow(...frames: Float32Array[]): Float32Array[] {
  return frames;
}

describe("detectFormErrorsFromRepWindow", () => {
  const frontConfig = getSquatRuntimeConfig({
    anglePreset: "front",
    sensitivity: "normal",
  });

  test("flags insufficient depth on shallow squat", () => {
    const shallow = frontStandingFrame();
    setLm(shallow, LM.LEFT_KNEE, 0.4, 0.55);
    setLm(shallow, LM.RIGHT_KNEE, 0.6, 0.55);
    const errors = detectFormErrorsFromRepWindow(
      repWindow(frontStandingFrame(), shallow, frontStandingFrame()),
      frontConfig,
    );
    expect(errors.insufficient_depth).toBeGreaterThan(0.5);
    expect(errors.knee_valgus).toBeLessThan(0.3);
  });

  test("good depth rep has low depth error", () => {
    const errors = detectFormErrorsFromRepWindow(
      repWindow(
        frontStandingFrame(),
        frontDeepGoodFrame(),
        frontDeepGoodFrame(),
      ),
      frontConfig,
    );
    expect(errors.insufficient_depth).toBeLessThan(0.3);
    expect(errors.forward_lean).toBeLessThan(0.3);
  });

  test("flags knee valgus when knees cave inward (front view)", () => {
    const valgus = frontDeepGoodFrame();
    setLm(valgus, LM.LEFT_KNEE, 0.46, 0.76);
    setLm(valgus, LM.RIGHT_KNEE, 0.54, 0.76);
    const errors = detectFormErrorsFromRepWindow(
      repWindow(frontStandingFrame(), valgus, valgus),
      frontConfig,
    );
    expect(errors.knee_valgus).toBeGreaterThan(0.5);
  });

  test("flags forward lean when torso is pitched forward at bottom", () => {
    const lean = frontDeepGoodFrame();
    setLm(lean, LM.LEFT_SHOULDER, 0.38, 0.5, -0.15);
    setLm(lean, LM.RIGHT_SHOULDER, 0.62, 0.5, -0.15);
    setLm(lean, LM.LEFT_HIP, 0.4, 0.64, 0);
    setLm(lean, LM.RIGHT_HIP, 0.6, 0.64, 0);
    const errors = detectFormErrorsFromRepWindow(
      repWindow(frontStandingFrame(), lean, lean),
      frontConfig,
    );
    expect(errors.forward_lean).toBeGreaterThan(0.4);
  });

  test("skips valgus on side view", () => {
    const sideConfig = getSquatRuntimeConfig({ anglePreset: "side" });
    const valgus = frontDeepGoodFrame();
    setLm(valgus, LM.LEFT_KNEE, 0.46, 0.76);
    const errors = detectFormErrorsFromRepWindow(
      repWindow(frontStandingFrame(), valgus),
      sideConfig,
    );
    expect(errors.knee_valgus).toBe(0);
  });
});
