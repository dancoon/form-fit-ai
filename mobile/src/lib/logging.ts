/** Dev-only logging; errors always reported for diagnostics. */
export function devLog(...args: unknown[]): void {
  if (__DEV__) console.log(...args);
}

export function devWarn(...args: unknown[]): void {
  if (__DEV__) console.warn(...args);
}

export function logError(tag: string, error: unknown): void {
  console.error(`[${tag}]`, error);
}
