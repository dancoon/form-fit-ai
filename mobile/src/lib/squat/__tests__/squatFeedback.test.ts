import { describe, expect, test } from "bun:test";
import { FEEDBACK } from "@/constants/feedbackStrings";
import { SquatPhase } from "@/lib/squat/repDetector";
import {
  buildTrackerFeedback,
  buildVocalFeedback,
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

const baseInput = {
  result: null,
  repCountOnlyMode: false,
  activeViewAngle: "side" as const,
};

describe("buildTrackerFeedback", () => {
  test("prompts to hold still when auto-calibration not started", () => {
    const msg = buildTrackerFeedback({
      tracker: minimalTracker(),
      ...baseInput,
    });
    expect(msg).toBe(FEEDBACK.holdStillToCalibrate);
  });

  test("side vs front calibration copy", () => {
    const side = buildTrackerFeedback({
      tracker: minimalTracker({ calibrationRequested: true }),
      ...baseInput,
    });
    const front = buildTrackerFeedback({
      tracker: minimalTracker({ calibrationRequested: true }),
      ...baseInput,
      activeViewAngle: "front",
    });
    expect(side).toBe(FEEDBACK.calibrateSide);
    expect(front).toBe(FEEDBACK.calibrateFront);
  });

  test("next rep at descent, silent during squat", () => {
    const descent = buildTrackerFeedback({
      tracker: minimalTracker({
        calibrated: true,
        calibrationRequested: true,
        standingBaseline: 170,
        hipKneeAngle: 155,
      }),
      ...baseInput,
    });
    const squatting = buildTrackerFeedback({
      tracker: minimalTracker({
        calibrated: true,
        calibrationRequested: true,
        isSquatting: true,
      }),
      ...baseInput,
    });
    expect(descent).toBe(FEEDBACK.nextRep);
    expect(squatting).toBe("");
  });

  test("model feedback takes precedence", () => {
    const msg = buildTrackerFeedback({
      tracker: minimalTracker({ calibrated: true, repCount: 1 }),
      result: {
        isCorrect: true,
        confidence: 0.9,
        incorrectProbability: 0.1,
        kneeAngle: 100,
        errors: {
          knee_valgus: 0,
          insufficient_depth: 0,
          forward_lean: 0,
        },
        feedback: FEEDBACK.goodForm,
        repNumber: 1,
        phase: SquatPhase.Standing,
      },
      ...baseInput,
    });
    expect(msg).toBe(FEEDBACK.goodForm);
  });

  test("rep count only mode after reps", () => {
    const msg = buildTrackerFeedback({
      tracker: minimalTracker({ repCount: 2 }),
      ...baseInput,
      repCountOnlyMode: true,
    });
    expect(msg).toBe(FEEDBACK.repCountOnly);
  });
});

describe("buildVocalFeedback", () => {
  test("silent between reps until model result", () => {
    const msg = buildVocalFeedback({
      tracker: minimalTracker({
        calibrated: true,
        calibrationRequested: true,
        repCount: 1,
      }),
      ...baseInput,
    });
    expect(msg).toBe("");
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
    expect(msg).toContain(FEEDBACK.kneeValgus);
  });
});
