import * as Speech from "expo-speech";
import { normalizeForSpeech } from "@/lib/speech/normalizeForSpeech";

const queue: string[] = [];
let speaking = false;

function onUtteranceEnd(): void {
  speaking = false;
  const next = queue.shift();
  if (next) startSpeaking(next);
}

function startSpeaking(text: string): void {
  speaking = true;
  Speech.speak(text, {
    rate: 1.0,
    pitch: 1.0,
    onDone: onUtteranceEnd,
    onStopped: onUtteranceEnd,
  });
}

/** Queue utterances sequentially — does not interrupt an in-progress line. */
export function speakFeedback(message: string): void {
  const normalized = normalizeForSpeech(message);
  if (!normalized) return;

  if (speaking) {
    if (queue[queue.length - 1] !== normalized) {
      queue.push(normalized);
    }
    return;
  }

  startSpeaking(normalized);
}

export function clearSpeechQueue(): void {
  queue.length = 0;
  speaking = false;
  Speech.stop();
}
