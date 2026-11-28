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
  // Truncate (not round) to prevent overflow across the minute boundary
  // (59.9999s -> 59.999, not 60.000). The epsilon compensates for binary
  // float representation (1.001 * 1000 === 1000.9999...; plain floor would
  // render it 1ms low); the Math.min clamp keeps the boundary guard airtight
  // for values the epsilon would otherwise push over (59.9999999...).
  let secs: string;
  if (decimals === 0) {
    secs = String(Math.min(Math.floor(secsRem + 1e-6), 59)).padStart(2, '0');
  } else {
    const factor = 10 ** decimals;
    const truncated = Math.min(Math.floor(secsRem * factor + 1e-6), 60 * factor - 1);
    secs = (truncated / factor).toFixed(decimals).padStart(decimals + 3, '0');
  }
  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + secs;
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

/** A non-negative decimal number with nothing around it: `5`, `1.5`, `1.`, `.5`. */
const DECIMAL = /^(\d+\.?\d*|\.\d+)$/;
/** A whole number of hours or minutes. */
const WHOLE = /^\d+$/;
const SECONDS_PER_UNIT = [3600, 60, 1];

/**
 * Read `s`, `m:s` or `h:m:s`. Only the last part (the seconds) may have
 * decimals; the first part may be any size, and each later part must be
 * under 60. The same rule as `parseTime` in `@waveform-playlist/ui-components`
 * (`src/utils/timeFormat.ts`): keep the two in step.
 */
function parseClock(text: string): number | null {
  const parts = text.split(':');
  if (parts.length > 3) return null;
  const units = SECONDS_PER_UNIT.slice(3 - parts.length);
  let total = 0;
  for (let i = 0; i < parts.length; i++) {
    const isLast = i === parts.length - 1;
    if (!(isLast ? DECIMAL : WHOLE).test(parts[i])) return null;
    const value = Number(parts[i]);
    if (i > 0 && value >= 60) return null;
    total += value * units[i];
  }
  return total;
}

/**
 * Parse text typed for a time back to seconds, or `null` when it is not a
 * time: empty text, a negative number, letters, or a number followed by
 * anything else. Spaces around the text are ignored. `seconds` reads a plain
 * number; the clock formats also read `1.5` (seconds) and `1:30` (minutes and
 * seconds) besides `01:02:03.500`. Segment ranges are checked: `00:75:00` is
 * not a time.
 */
export function parseDisplayTime(value: string, format: TimeDisplayFormat): number | null {
  const text = value.trim();
  if (format === 'seconds') return DECIMAL.test(text) ? Number(text) : null;
  return parseClock(text);
}
