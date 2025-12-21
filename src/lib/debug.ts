export const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === '1';

export function installConsoleLogGate(): void {
  // Only affects the browser console (this module is safe to import anywhere).
  if (typeof window === 'undefined') return;
  if (DEBUG_LOGS) return;

  // eslint-disable-next-line no-console
  console.log = () => {};
}

export function debugLog(...args: unknown[]): void {
  if (!DEBUG_LOGS) return;
  // eslint-disable-next-line no-console
  console.log(...args);
}
