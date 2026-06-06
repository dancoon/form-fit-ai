import { describe, expect, test } from "bun:test";
import { FEEDBACK } from "@/constants/feedbackStrings";
import { SquatPhase } from "@/lib/squat/repDetector";
import {
  buildTrackerFeedback,
  formatSquatFeedback,
} from "@/lib/squat/squatFeedback";
import type { RepTrackerSnapshot } from "@/lib/squat/repDetector";

function minimalTracker(
  overrides: Partial<RepTrackerSnapshot> = {},
): RepTrackerSnapshot {
  return {
    phase: SquatPhase.Standing,
    repCount: 0,
    kneeAngle: 170,
    hipKneeAngle: 170,
    viewAngle: "side",
    shoulderY: 0.3,
    smoothedShoulderY: 0.3,
    standingBaseline: 170,
    calibrated: false,
    calibrationRequested: false,
    isSquatting: false,
    repProgress: 0,
    activeRepFrameCount: 0,
    repCompleted: false,
    repWindowReady: false,
    repWindow: null,
    repMinHipKneeAngle: null,
    ...overrides,
  };
}

describe("buildTrackerFeedback", () => {
  test("prompts to calibrate when not requested", () => {
    const msg = buildTrackerFeedback({
      tracker: minimalTracker(),
      result: null,
      liveCue: "",
      repCountOnlyMode: false,
      activeViewAngle: "side",
    });
    expect(msg).toBe(FEEDBACK.tapToCalibrate);
  });

  test("side vs front calibration copy", () => {
    const side = buildTrackerFeedback({
      tracker: minimalTracker({ calibrationRequested: true }),
      result: null,
      liveCue: "",
      repCountOnlyMode: false,
      activeViewAngle: "side",
    });
    const front = buildTrackerFeedback({
      tracker: minimalTracker({ calibrationRequested: true }),
      result: null,
      liveCue: "",
      repCountOnlyMode: false,
      activeViewAngle: "front",
    });
    expect(side).toBe(FEEDBACK.calibrateSide);
    expect(front).toBe(FEEDBACK.calibrateFront);
  });

  test("live cue takes precedence", () => {
    const msg = buildTrackerFeedback({
      tracker: minimalTracker({ calibrated: true, isSquatting: true }),
      result: null,
      liveCue: "Knees out",
      repCountOnlyMode: false,
      activeViewAngle: "side",
    });
    expect(msg).toBe("Knees out");
  });

  test("rep count only mode after reps", () => {
    const msg = buildTrackerFeedback({
      tracker: minimalTracker({ repCount: 2 }),
      result: null,
      liveCue: "",
      repCountOnlyMode: true,
      activeViewAngle: "side",
    });
    expect(msg).toBe(FEEDBACK.repCountOnly);
  });
});

describe("formatSquatFeedback", () => {
  test("still formats model errors", () => {
    const msg = formatSquatFeedback({
      isCorrect: false,
      confidence: 0.6,
      incorrectProbability: 0.6,
      kneeAngle: 100,
      errors: {
        knee_valgus: 0.7,
        insufficient_depth: 0.1,
        forward_lean: 0.1,
      },
    });
    expect(msg).toContain("Knees caving inward");
  });
});
