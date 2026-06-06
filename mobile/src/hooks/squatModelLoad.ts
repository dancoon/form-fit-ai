import type { TfliteModel } from "react-native-fast-tflite";

export const MODEL_LOAD_RETRIES = 2;

export type ModelLoadAttemptResult =
  | { status: "loaded"; model: TfliteModel }
  | { status: "error"; error: Error };

export function toModelLoadError(lastError: unknown): Error {
  return lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "Model load failed"));
}

/** Testable retry loop used by useSquatModel. */
export async function loadSquatModelWithRetry(
  loader: () => Promise<TfliteModel>,
  retries = MODEL_LOAD_RETRIES,
): Promise<ModelLoadAttemptResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const model = await loader();
      return { status: "loaded", model };
    } catch (error) {
      lastError = error;
    }
  }
  return { status: "error", error: toModelLoadError(lastError) };
}
