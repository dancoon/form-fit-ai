import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC_ROOT = join(import.meta.dir, "..", "..", "..");
const LIB_ROOT = join(SRC_ROOT, "lib");
const CONSTANTS_ROOT = join(SRC_ROOT, "constants");
const FORBIDDEN_LIB_IMPORT = /@\/(app|components|hooks|context)(\/|")/;
const FORBIDDEN_CONSTANTS_IMPORT = /@\/lib\//;

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      out.push(...listTsFiles(path));
    } else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
      out.push(path);
    }
  }
  return out;
}

describe("architecture boundaries", () => {
  test("src/lib does not import UI or React adapter layers", () => {
    const violations: string[] = [];
    for (const file of listTsFiles(LIB_ROOT)) {
      const content = readFileSync(file, "utf8");
      if (FORBIDDEN_LIB_IMPORT.test(content)) {
        violations.push(file.replace(/\\/g, "/"));
      }
    }
    expect(violations).toEqual([]);
  });

  test("src/constants does not import domain lib", () => {
    const violations: string[] = [];
    for (const file of listTsFiles(CONSTANTS_ROOT)) {
      const content = readFileSync(file, "utf8");
      if (FORBIDDEN_CONSTANTS_IMPORT.test(content)) {
        violations.push(file.replace(/\\/g, "/"));
      }
    }
    expect(violations).toEqual([]);
  });
});
