import { describe, expect, test } from "bun:test";
import { FEEDBACK } from "@/constants/feedbackStrings";
import {
  meanHipKneeSegmentAngle,
  meanKneeAngle,
} from "@/lib/squat/biomechanics";
import { SQUAT_RAW_LANDMARK_DIM } from "@/lib/squat/constants";
import { LM } from "@/lib/squat/landmarkIndices";
import { SquatRepTracker } from "@/lib/squat/repDetector";
import { inferViewAngle } from "@/lib/squat/repMetrics";
import { getSquatRuntimeConfig } from "@/lib/squat/squatConfig";
import { formatSquatFeedback } from "@/lib/squat/squatFeedback";

function setLm(
  frame: Float32Array,
  idx: number,
  x: number,
  y: number,
  z = 0,
  vis = 0.95,
): void {
  const b = idx * 4;
  frame[b] = x;
  frame[b + 1] = y;
  frame[b + 2] = z;
  frame[b + 3] = vis;
}

/** Side-view standing pose — narrow shoulder span. */
function sideStandingFrame(): Float32Array {
  const f = new Float32Array(SQUAT_RAW_LANDMARK_DIM);
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

/** Side-view deep squat — near leg deep, far leg vertical. */
function sideDeepFrame(): Float32Array {
  const f = sideStandingFrame();
  setLm(f, LM.LEFT_HIP, 0.52, 0.68);
  setLm(f, LM.LEFT_KNEE, 0.38, 0.71);
  setLm(f, LM.LEFT_ANKLE, 0.36, 0.88);
  return f;
}

/** Front-view standing — wide shoulders, straight knees. */
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

/** Front-view deep squat — symmetric knee bend. */
function frontDeepFrame(): Float32Array {
  const f = frontStandingFrame();
  setLm(f, LM.LEFT_HIP, 0.4, 0.64);
  setLm(f, LM.RIGHT_HIP, 0.6, 0.64);
  setLm(f, LM.LEFT_KNEE, 0.32, 0.76);
  setLm(f, LM.RIGHT_KNEE, 0.68, 0.76);
  setLm(f, LM.LEFT_ANKLE, 0.3, 0.92);
  setLm(f, LM.RIGHT_ANKLE, 0.7, 0.92);
  return f;
}

describe("view inference", () => {
  test("detects side vs front from shoulder span", () => {
    expect(inferViewAngle(sideStandingFrame())).toBe("side");
    expect(inferViewAngle(frontStandingFrame())).toBe("front");
  });
});

describe("biomechanics", () => {
  test("knee angle decreases when squatting deeper (front)", () => {
    const stand = meanKneeAngle(frontStandingFrame());
    const deep = meanKneeAngle(frontDeepFrame());
    expect(deep).toBeLessThan(stand);
  });

  test("hip-knee segment angle decreases at depth (side)", () => {
    const stand = meanHipKneeSegmentAngle(sideStandingFrame());
    const deep = meanHipKneeSegmentAngle(sideDeepFrame());
    expect(deep).toBeLessThan(stand);
  });
});

describe("SquatRepTracker auto-calibration", () => {
  test("requests calibration after stable standing without a button press", () => {
    const tracker = new SquatRepTracker({
      runtimeConfig: getSquatRuntimeConfig({ anglePreset: "side" }),
    });
    let sawRequested = false;
    let sawCalibrated = false;
    for (let i = 0; i < 30; i++) {
      const snap = tracker.pushFrame(sideStandingFrame());
      if (snap.calibrationRequested) sawRequested = true;
      if (snap.calibrated) sawCalibrated = true;
    }
    expect(sawRequested).toBe(true);
    expect(sawCalibrated).toBe(true);
  });

  test("resets stability progress when standing pose moves", () => {
    const tracker = new SquatRepTracker({
      runtimeConfig: getSquatRuntimeConfig({ anglePreset: "side" }),
    });
    for (let i = 0; i < 8; i++) tracker.pushFrame(sideStandingFrame());
    tracker.pushFrame(sideDeepFrame());
    expect(tracker.pushFrame(sideStandingFrame()).calibrationRequested).toBe(
      false,
    );
  });
});

describe("SquatRepTracker side view", () => {
  test("does not end rep during early descent before bottom", () => {
    const tracker = new SquatRepTracker({
      runtimeConfig: getSquatRuntimeConfig({ anglePreset: "side" }),
    });
    tracker.requestCalibration();
    for (let i = 0; i < 12; i++) tracker.pushFrame(sideStandingFrame());

    tracker.pushFrame(sideDeepFrame());
    for (let i = 0; i < 10; i++) {
      const snap = tracker.pushFrame(sideDeepFrame());
      expect(snap.repCount).toBe(0);
      expect(snap.isSquatting).toBe(true);
    }
  });

  test("starts rep when visible leg reaches depth", () => {
    const tracker = new SquatRepTracker({
      runtimeConfig: getSquatRuntimeConfig({ anglePreset: "side" }),
    });
    tracker.requestCalibration();
    for (let i = 0; i < 12; i++) tracker.pushFrame(sideStandingFrame());

    let sawSquatting = false;
    for (let i = 0; i < 15; i++) {
      if (tracker.pushFrame(sideDeepFrame()).isSquatting) sawSquatting = true;
    }
    expect(sawSquatting).toBe(true);
  });

  test("counts full rep cycle", () => {
    const tracker = new SquatRepTracker({
      runtimeConfig: getSquatRuntimeConfig({ anglePreset: "side" }),
    });
    tracker.requestCalibration();
    for (let i = 0; i < 12; i++) tracker.pushFrame(sideStandingFrame());
    for (let i = 0; i < 20; i++) tracker.pushFrame(sideDeepFrame());
    for (let i = 0; i < 25; i++) tracker.pushFrame(sideStandingFrame());
    expect(
      tracker.pushFrame(sideStandingFrame()).repCount,
    ).toBeGreaterThanOrEqual(1);
  });
});

describe("SquatRepTracker front view", () => {
  test("calibrates when facing camera", () => {
    const tracker = new SquatRepTracker({
      runtimeConfig: getSquatRuntimeConfig({ anglePreset: "front" }),
    });
    tracker.requestCalibration();
    for (let i = 0; i < 12; i++) {
      const snap = tracker.pushFrame(frontStandingFrame());
      if (i >= 10) expect(snap.calibrated).toBe(true);
    }
  });

  test("starts rep using knee angle when facing camera", () => {
    const tracker = new SquatRepTracker({
      runtimeConfig: getSquatRuntimeConfig({ anglePreset: "front" }),
    });
    tracker.requestCalibration();
    for (let i = 0; i < 12; i++) tracker.pushFrame(frontStandingFrame());

    let sawSquatting = false;
    for (let i = 0; i < 20; i++) {
      if (tracker.pushFrame(frontDeepFrame()).isSquatting) sawSquatting = true;
    }
    expect(sawSquatting).toBe(true);
  });

  test("counts full rep cycle facing camera", () => {
    const tracker = new SquatRepTracker({
      runtimeConfig: getSquatRuntimeConfig({ anglePreset: "front" }),
    });
    tracker.requestCalibration();
    for (let i = 0; i < 12; i++) tracker.pushFrame(frontStandingFrame());
    for (let i = 0; i < 20; i++) tracker.pushFrame(frontDeepFrame());
    for (let i = 0; i < 25; i++) tracker.pushFrame(frontStandingFrame());
    expect(
      tracker.pushFrame(frontStandingFrame()).repCount,
    ).toBeGreaterThanOrEqual(1);
  });
});

describe("squatConfig", () => {
  test("side uses min knee, front uses mean knee", () => {
    const side = getSquatRuntimeConfig({ anglePreset: "side" });
    const front = getSquatRuntimeConfig({ anglePreset: "front" });
    expect(side.rep.trackingMode).toBe("knee_min");
    expect(front.rep.trackingMode).toBe("knee_mean");
    expect(side.rep.downAngle).toBe(front.rep.downAngle);
  });
});

describe("formatSquatFeedback", () => {
  const base = {
    confidence: 0.7,
    incorrectProbability: 0.7,
    kneeAngle: 120,
  };

  test("names specific errors above threshold", () => {
    const msg = formatSquatFeedback({
      ...base,
      isCorrect: false,
      errors: {
        knee_valgus: 0.65,
        insufficient_depth: 0.2,
        forward_lean: 0.1,
      },
    });
    expect(msg).toContain(FEEDBACK.kneeValgus);
  });

  test("falls back to strongest error head when none exceed threshold", () => {
    const msg = formatSquatFeedback({
      ...base,
      isCorrect: false,
      errors: {
        knee_valgus: 0.35,
        insufficient_depth: 0.42,
        forward_lean: 0.18,
      },
    });
    expect(msg).toBe(FEEDBACK.insufficientDepth);
  });
});
