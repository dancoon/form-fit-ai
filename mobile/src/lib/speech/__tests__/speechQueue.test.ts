import { afterEach, describe, expect, mock, test } from "bun:test";

const speakMock = mock(() => {});
const stopMock = mock(() => {});

mock.module("expo-speech", () => ({
  speak: speakMock,
  stop: stopMock,
}));

const { clearSpeechQueue, speakFeedback } = await import(
  "@/lib/speech/speechQueue"
);

afterEach(() => {
  clearSpeechQueue();
  speakMock.mockClear();
  stopMock.mockClear();
});

describe("speechQueue", () => {
  test("speaks immediately when idle", () => {
    speakFeedback("Hello");
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock.mock.calls[0]?.[0]).toBe("Hello");
  });

  test("queues while speaking without stopping", () => {
    speakFeedback("First");
    speakFeedback("Second");
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(stopMock).not.toHaveBeenCalled();
  });
});
