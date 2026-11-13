/**
 * Development-only warnings for a part of the view that is rendered where it
 * cannot work (#685). A misplaced part does not throw: it draws nothing, or
 * draws in the wrong place, and says so once in the console.
 */
const warned = new Set<string>();

export function warnMisplacedPart(message: string): void {
  if (process.env.NODE_ENV === 'production') return;
  if (warned.has(message)) return;
  warned.add(message);
  console.warn('[waveform-playlist] ' + message);
}

/** For tests: forget what has been warned, so each test sees its own warning. */
export function resetPartWarnings(): void {
  warned.clear();
}
