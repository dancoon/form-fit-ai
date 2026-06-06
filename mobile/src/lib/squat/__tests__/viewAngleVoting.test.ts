import { describe, expect, test } from "bun:test";
import { SQUAT_RAW_LANDMARK_DIM } from "@/lib/squat/constants";
import { LM } from "@/lib/squat/landmarkIndices";
import {
  AUTO_VIEW_VOTE_FRAME_THRESHOLD,
  ViewAngleVoter,
} from "@/lib/squat/viewAngleVoting";

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

function sideFrame(): Float32Array {
  const f = new Float32Array(SQUAT_RAW_LANDMARK_DIM);
  setLm(f, LM.LEFT_SHOULDER, 0.55, 0.28);
  setLm(f, LM.RIGHT_SHOULDER, 0.45, 0.28);
  return f;
}

function frontFrame(): Float32Array {
  const f = new Float32Array(SQUAT_RAW_LANDMARK_DIM);
  setLm(f, LM.LEFT_SHOULDER, 0.2, 0.28);
  setLm(f, LM.RIGHT_SHOULDER, 0.8, 0.28);
  return f;
}

describe("ViewAngleVoter", () => {
  test("returns null until vote threshold", () => {
    const voter = new ViewAngleVoter();
    for (let i = 0; i < AUTO_VIEW_VOTE_FRAME_THRESHOLD - 1; i++) {
      expect(voter.vote(sideFrame())).toBeNull();
    }
  });

  test("commits side after enough side frames", () => {
    const voter = new ViewAngleVoter();
    let result: "side" | "front" | null = null;
    for (let i = 0; i < AUTO_VIEW_VOTE_FRAME_THRESHOLD; i++) {
      result = voter.vote(sideFrame());
    }
    expect(result).toBe("side");
  });

  test("commits front when front dominates", () => {
    const voter = new ViewAngleVoter();
    let result: "side" | "front" | null = null;
    for (let i = 0; i < AUTO_VIEW_VOTE_FRAME_THRESHOLD; i++) {
      result = voter.vote(frontFrame());
    }
    expect(result).toBe("front");
  });

  test("reset clears accumulated votes", () => {
    const voter = new ViewAngleVoter();
    for (let i = 0; i < 10; i++) voter.vote(sideFrame());
    voter.reset();
    expect(voter.vote(sideFrame())).toBeNull();
  });
});
