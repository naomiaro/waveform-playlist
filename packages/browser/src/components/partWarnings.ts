/**
 * Development-only warnings, written once per message for the life of the
 * page: for a part of the view that is rendered where it cannot work (#685;
 * it does not throw: it draws nothing, or draws in the wrong place), and for a
 * call with an argument of an older signature (#687).
 */
const warned = new Set<string>();

export function warnOnce(message: string): void {
  if (process.env.NODE_ENV === 'production') return;
  if (warned.has(message)) return;
  warned.add(message);
  console.warn('[waveform-playlist] ' + message);
}

/** A part of the view that is not where it can work. */
export const warnMisplacedPart = warnOnce;

/** For tests: forget what has been warned, so each test sees its own warning. */
export function resetPartWarnings(): void {
  warned.clear();
}
