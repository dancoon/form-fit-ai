import { describe, expect, test } from "bun:test";
import type { TfliteModel } from "react-native-fast-tflite";
import {
  loadSquatModelWithRetry,
  toModelLoadError,
} from "@/hooks/squatModelLoad";

const fakeModel = { inputs: [], outputs: [] } as TfliteModel;

describe("loadSquatModelWithRetry", () => {
  test("returns model on first success", async () => {
    let calls = 0;
    const result = await loadSquatModelWithRetry(async () => {
      calls++;
      return fakeModel;
    });
    expect(result.status).toBe("loaded");
    expect(calls).toBe(1);
  });

  test("retries then succeeds", async () => {
    let calls = 0;
    const result = await loadSquatModelWithRetry(async () => {
      calls++;
      if (calls < 2) throw new Error("transient");
      return fakeModel;
    }, 2);
    expect(result.status).toBe("loaded");
    expect(calls).toBe(2);
  });

  test("returns error after exhausting retries", async () => {
    const result = await loadSquatModelWithRetry(async () => {
      throw new Error("permanent");
    }, 2);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.error.message).toBe("permanent");
    }
  });
});

describe("toModelLoadError", () => {
  test("wraps non-Error values", () => {
    expect(toModelLoadError("oops").message).toBe("oops");
  });
});
