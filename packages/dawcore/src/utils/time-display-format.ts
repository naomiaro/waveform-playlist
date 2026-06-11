/**
 * Time display formats for <daw-time-display> / <daw-time-format> and the
 * editor's `time-format` attribute. The three formats come from the
 * web-components-migration spec ("Element Registry": hh:mm:ss.sss | hh:mm:ss
 * | seconds). parseDisplayTime exists for the selection inputs (#463).
 */
export type TimeDisplayFormat = 'hh:mm:ss.sss' | 'hh:mm:ss' | 'seconds';

export const TIME_DISPLAY_FORMATS: readonly TimeDisplayFormat[] = [
  'hh:mm:ss.sss',
  'hh:mm:ss',
  'seconds',
];

export function isTimeDisplayFormat(value: unknown): value is TimeDisplayFormat {
  return TIME_DISPLAY_FORMATS.includes(value as TimeDisplayFormat);
}

function clockFormat(totalSeconds: number, decimals: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const secsRem = totalSeconds % 60;
  // Truncate (not round) to prevent overflow across the minute boundary (59.9999s -> 59.999, not 60.000)
  const secs =
    decimals === 0
      ? Math.floor(secsRem).toString().padStart(2, '0')
      : (Math.floor(secsRem * Math.pow(10, decimals)) / Math.pow(10, decimals)).toFixed(decimals);
  return (
    String(hours).padStart(2, '0') +
    ':' +
    String(minutes).padStart(2, '0') +
    ':' +
    (decimals === 0 ? secs : secs.padStart(decimals + 3, '0'))
  );
}

/** Format seconds for display. Non-finite or negative input renders as 0. */
export function formatDisplayTime(seconds: number, format: TimeDisplayFormat): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  switch (format) {
    case 'seconds':
      // 'seconds' rounds via toFixed; clock formats truncate. Rounding is safe here since no minute-boundary overflow can occur in plain seconds.
      return safe.toFixed(3);
    case 'hh:mm:ss':
      return clockFormat(safe, 0);
    case 'hh:mm:ss.sss':
    default:
      return clockFormat(safe, 3);
  }
}

/** Parse a formatted time string back to seconds. Lenient: returns 0 for empty/unparseable input; does not validate segment ranges. */
export function parseDisplayTime(value: string, format: TimeDisplayFormat): number {
  if (!value) return 0;
  let seconds = 0;
  if (format === 'seconds') {
    seconds = parseFloat(value) || 0;
  } else {
    const parts = value.split(':');
    if (parts.length !== 3) return 0;
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    const s = parseFloat(parts[2]) || 0;
    seconds = h * 3600 + m * 60 + s;
  }
  return Math.max(0, seconds);
}
