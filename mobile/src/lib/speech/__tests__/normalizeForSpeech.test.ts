import { describe, expect, test } from "bun:test";
import { normalizeForSpeech } from "@/lib/speech/normalizeForSpeech";

describe("normalizeForSpeech", () => {
  test("removes rep progress percentage", () => {
    expect(normalizeForSpeech("Nice and controlled on the way down (45%)")).toBe(
      "Nice and controlled on the way down",
    );
  });

  test("removes model confidence suffix", () => {
    expect(normalizeForSpeech("Excellent form! (92% confidence)")).toBe(
      "Excellent form!",
    );
  });

  test("removes error score suffix", () => {
    expect(
      normalizeForSpeech("Push your knees out slightly (70%)"),
    ).toBe("Push your knees out slightly");
  });
});
