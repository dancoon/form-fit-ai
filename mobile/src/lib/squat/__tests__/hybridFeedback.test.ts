import { describe, expect, test } from "bun:test";
import { FEEDBACK } from "@/constants/feedbackStrings";
import { mergeRulesFirst } from "@/lib/squat/squatInference";
import { getSquatRuntimeConfig } from "@/lib/squat/squatConfig";
import type { SquatPrediction } from "@/lib/squat/squatTypes";

const config = getSquatRuntimeConfig({ formFeedbackSource: "hybrid" });

const modelBase: SquatPrediction = {
  isCorrect: true,
  confidence: 0.9,
  incorrectProbability: 0.1,
  kneeAngle: 100,
  errors: { knee_valgus: 0.1, insufficient_depth: 0.1, forward_lean: 0.1 },
};

describe("mergeRulesFirst (hybrid)", () => {
  test("rules win when biomech flags insufficient depth", () => {
    const merged = mergeRulesFirst(
      modelBase,
      { knee_valgus: 0, insufficient_depth: 0.8, forward_lean: 0 },
      [],
      config,
    );
    expect(merged.isCorrect).toBe(false);
    expect(merged.errors.insufficient_depth).toBe(0.8);
  });

  test("model kept when biomech is clear", () => {
    const modelBad: SquatPrediction = {
      ...modelBase,
      isCorrect: false,
      incorrectProbability: 0.7,
      errors: { knee_valgus: 0.7, insufficient_depth: 0.1, forward_lean: 0.1 },
    };
    const merged = mergeRulesFirst(
      modelBad,
      { knee_valgus: 0.1, insufficient_depth: 0.1, forward_lean: 0.1 },
      [],
      config,
    );
    expect(merged.isCorrect).toBe(false);
    expect(merged.errors.knee_valgus).toBe(0.7);
  });

});
