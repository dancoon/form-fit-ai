import { describe, expect, test } from "bun:test";
import { SquatPhase } from "@/lib/squat/repDetector";
import type { RepTrackerSnapshot } from "@/lib/squat/repDetector";
import {
  hasTrackerUiChanged,
  trackerUiFingerprint,
} from "@/lib/squat/trackerUi";

const base: RepTrackerSnapshot = {
  phase: SquatPhase.Eccentric,
  repCount: 1,
  kneeAngle: 120,
  hipKneeAngle: 110,
  viewAngle: "side",
  shoulderY: 0.3,
  smoothedShoulderY: 0.3,
  standingBaseline: 170,
  calibrated: true,
  calibrationRequested: true,
  isSquatting: true,
  repProgress: 0.41,
  activeRepFrameCount: 12,
  repCompleted: false,
  repWindowReady: false,
  repWindow: null,
  repMinHipKneeAngle: 95,
};

describe("trackerUi", () => {
  test("ignores sub-5% rep progress noise", () => {
    const a = { ...base, repProgress: 0.41 };
    const b = { ...base, repProgress: 0.43 };
    expect(hasTrackerUiChanged(a, b)).toBe(false);
  });

  test("detects phase change", () => {
    const a = base;
    const b = { ...base, phase: SquatPhase.Bottom };
    expect(hasTrackerUiChanged(a, b)).toBe(true);
  });

  test("fingerprint is stable for same UI state", () => {
    expect(trackerUiFingerprint(base)).toBe(
      trackerUiFingerprint({ ...base, repProgress: 0.42 }),
    );
  });

  test("buckets active rep frame count", () => {
    const a = { ...base, activeRepFrameCount: 12 };
    const b = { ...base, activeRepFrameCount: 14 };
    expect(hasTrackerUiChanged(a, b)).toBe(false);
  });
});
