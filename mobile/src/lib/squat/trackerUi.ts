import type { RepTrackerSnapshot } from "@/lib/squat/repDetector";

/** Buckets rep progress so UI state does not update every pose frame. */
const REP_PROGRESS_UI_STEP = 0.05;

/** Buffer frame count updates in coarse steps (avoids ~30 React updates/sec mid-rep). */
const REP_FRAME_COUNT_UI_STEP = 5;

/**
 * Fingerprint of tracker fields that drive React UI.
 * Ignores high-frequency noise while preserving rep/phase transitions.
 */
export function trackerUiFingerprint(snapshot: RepTrackerSnapshot): string {
  const progressBucket = Math.round(
    snapshot.repProgress / REP_PROGRESS_UI_STEP,
  );
  const frameCountBucket = Math.floor(
    snapshot.activeRepFrameCount / REP_FRAME_COUNT_UI_STEP,
  );
  return [
    snapshot.repCount,
    snapshot.phase,
    snapshot.calibrated,
    snapshot.calibrationRequested,
    snapshot.isSquatting,
    progressBucket,
    snapshot.repWindowReady,
    frameCountBucket,
    snapshot.repMinHipKneeAngle ?? "null",
    Math.round(snapshot.hipKneeAngle),
  ].join("|");
}

export function hasTrackerUiChanged(
  prev: RepTrackerSnapshot | null,
  next: RepTrackerSnapshot,
): boolean {
  if (!prev) return true;
  return trackerUiFingerprint(prev) !== trackerUiFingerprint(next);
}
