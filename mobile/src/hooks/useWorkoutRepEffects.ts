import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { useEffect, useRef } from "react";
import type { SquatInferenceResult } from "@/lib/squat/squatTypes";

export interface UseWorkoutRepEffectsParams {
  repCount: number;
  repMinHipKneeAngle: number | null;
  result: SquatInferenceResult | null;
  vocalFeedback: boolean;
  hapticFeedback: boolean;
  targetReps: number | null | undefined;
  restSecondsRemaining: number | null;
  recordRepCount: (
    repNumber: number,
    hipKneeAngleMin: number | null,
  ) => void;
  recordRep: (
    result: SquatInferenceResult,
    hipKneeAngleMin: number | null,
  ) => void;
  startRest: (seconds: number) => void;
  onRepInferenceComplete?: () => void;
}

/**
 * Side effects for rep completion: session storage, speech, haptics, rest timer.
 */
export function useWorkoutRepEffects({
  repCount,
  repMinHipKneeAngle,
  result,
  vocalFeedback,
  hapticFeedback,
  targetReps,
  restSecondsRemaining,
  recordRepCount,
  recordRep,
  startRest,
  onRepInferenceComplete,
}: UseWorkoutRepEffectsParams) {
  const lastProcessedRep = useRef(0);
  const lastInferenceRep = useRef(0);
  const lastSpokenRep = useRef(0);
  const lastHapticRep = useRef(0);

  useEffect(() => {
    if (repCount <= lastProcessedRep.current) return;
    lastProcessedRep.current = repCount;
    recordRepCount(repCount, repMinHipKneeAngle);

    if (
      targetReps &&
      repCount >= targetReps &&
      restSecondsRemaining === null
    ) {
      startRest(60);
    }
  }, [
    repCount,
    recordRepCount,
    repMinHipKneeAngle,
    targetReps,
    restSecondsRemaining,
    startRest,
  ]);

  useEffect(() => {
    if (!result) return;
    if (result.repNumber <= lastInferenceRep.current) return;
    lastInferenceRep.current = result.repNumber;
    recordRep(result, repMinHipKneeAngle);
    onRepInferenceComplete?.();
  }, [result, recordRep, repMinHipKneeAngle, onRepInferenceComplete]);

  useEffect(() => {
    if (!vocalFeedback || !result?.feedback) return;
    if (result.repNumber <= lastSpokenRep.current) return;
    lastSpokenRep.current = result.repNumber;
    Speech.stop();
    Speech.speak(result.feedback, { rate: 1.0, pitch: 1.0 });
  }, [result, vocalFeedback]);

  useEffect(() => {
    if (!hapticFeedback || !result) return;
    if (result.repNumber <= lastHapticRep.current) return;
    lastHapticRep.current = result.repNumber;
    if (!result.isCorrect) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [result, hapticFeedback]);

  const resetRepEffectRefs = () => {
    lastProcessedRep.current = 0;
    lastInferenceRep.current = 0;
    lastSpokenRep.current = 0;
    lastHapticRep.current = 0;
  };

  return { resetRepEffectRefs };
}
