/** Strips on-screen-only suffixes so TTS reads natural copy. */
export function normalizeForSpeech(text: string): string {
  return text
    .replace(/\s*\(\d+%(?:\s+confidence)?\)/gi, "")
    .replace(/\s*\(\d+%\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
