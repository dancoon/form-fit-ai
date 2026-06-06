const SUPPRESSED_WARN_FRAGMENTS = [
  "THREE.Clock",
  "pixelStorei",
  "WEBGL_lose_context",
] as const;

export interface ConsoleFilterHandle {
  restore: () => void;
}

/**
 * Scoped filter for known harmless expo-gl / three.js noise.
 * Install in a component effect; always call restore on cleanup.
 */
export function installExpoGlConsoleFilter(): ConsoleFilterHandle {
  const originalWarn = console.warn.bind(console);
  const originalLog = console.log.bind(console);

  console.warn = (...args: unknown[]) => {
    const msg = String(args[0] ?? "");
    if (SUPPRESSED_WARN_FRAGMENTS.some((f) => msg.includes(f))) return;
    originalWarn(...args);
  };

  console.log = (...args: unknown[]) => {
    const msg = String(args[0] ?? "");
    if (msg.includes("EXGL") && msg.includes("pixelStorei")) return;
    originalLog(...args);
  };

  return {
    restore: () => {
      console.warn = originalWarn;
      console.log = originalLog;
    },
  };
}
