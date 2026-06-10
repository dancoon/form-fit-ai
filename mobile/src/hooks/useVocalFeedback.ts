import { useEffect, useRef } from "react";
import { normalizeForSpeech } from "@/lib/speech/normalizeForSpeech";
import {
  clearSpeechQueue,
  speakFeedback,
} from "@/lib/speech/speechQueue";

export { speakFeedback, clearSpeechQueue } from "@/lib/speech/speechQueue";

/**
 * Speaks the active status-line feedback whenever its spoken form changes.
 * Dedupes phase progress ticks that only update the on-screen percentage.
 */
export function useVocalFeedback(feedback: string, enabled: boolean): void {
  const lastSpokenRef = useRef("");

  useEffect(() => {
    if (!enabled) {
      lastSpokenRef.current = "";
      clearSpeechQueue();
      return;
    }

    const normalized = normalizeForSpeech(feedback);
    if (!normalized) {
      lastSpokenRef.current = "";
      return;
    }

    if (normalized === lastSpokenRef.current) return;

    lastSpokenRef.current = normalized;
    speakFeedback(feedback);
  }, [feedback, enabled]);
}
