import { describe, expect, test } from "bun:test";
import { installExpoGlConsoleFilter } from "@/lib/expoGlConsole";

describe("installExpoGlConsoleFilter", () => {
  test("suppresses known warn fragments", () => {
    const original = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
      calls.push(args);
    };

    const handle = installExpoGlConsoleFilter();
    console.warn("THREE.Clock deprecated");
    console.warn("real warning");
    handle.restore();
    console.warn = original;

    expect(calls.length).toBe(1);
    expect(String(calls[0][0])).toBe("real warning");
  });

  test("restore returns original handlers", () => {
    const beforeWarn = console.warn;
    const beforeLog = console.log;
    const handle = installExpoGlConsoleFilter();
    handle.restore();
    expect(console.warn).toBe(beforeWarn);
    expect(console.log).toBe(beforeLog);
  });
});
