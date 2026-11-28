/**
 * Time format utilities for displaying and parsing audio timestamps
 */

export type TimeFormat =
  | 'seconds'
  | 'thousandths'
  | 'hh:mm:ss'
  | 'hh:mm:ss.u'
  | 'hh:mm:ss.uu'
  | 'hh:mm:ss.uuu';

/** Seconds as `formatTime` prints them: a negative, `NaN` or infinite time is 0. */
function printable(seconds: number): number {
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

/**
 * Format time in clock format (hh:mm:ss with optional decimals).
 *
 * The time is rounded once, as a whole, and then split, so a rounding that
 * reaches the next second carries into the minutes and hours (59.9996 s is
 * `00:01:00.000`, never `00:00:60.000`). Hours do not wrap at 24.
 */
function clockFormat(seconds: number, decimals: number): string {
  const [wholeText, fraction] = seconds.toFixed(decimals).split('.');
  const whole = Number(wholeText);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor(whole / 60) % 60;
  const secs = String(whole % 60).padStart(2, '0');

  return (
    String(hours).padStart(2, '0') +
    ':' +
    String(minutes).padStart(2, '0') +
    ':' +
    (fraction === undefined ? secs : `${secs}.${fraction}`)
  );
}

/**
 * Format seconds according to the specified format. A negative, `NaN` or
 * infinite time prints as 0.
 */
export function formatTime(seconds: number, format: TimeFormat): string {
  const safe = printable(seconds);
  switch (format) {
    case 'seconds':
      return safe.toFixed(0);
    case 'thousandths':
      return safe.toFixed(3);
    case 'hh:mm:ss':
      return clockFormat(safe, 0);
    case 'hh:mm:ss.u':
      return clockFormat(safe, 1);
    case 'hh:mm:ss.uu':
      return clockFormat(safe, 2);
    case 'hh:mm:ss.uuu':
      return clockFormat(safe, 3);
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
 * under 60.
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
 * anything else. Spaces around the text are ignored.
 *
 * The numeric formats (`seconds`, `thousandths`) read a plain number. The
 * clock formats also read the shorter forms `1.5` (seconds) and `1:30`
 * (minutes and seconds) besides `01:02:03.5`.
 */
export function parseTime(timeStr: string, format: TimeFormat): number | null {
  const text = timeStr.trim();
  switch (format) {
    case 'seconds':
    case 'thousandths':
      return DECIMAL.test(text) ? Number(text) : null;
    case 'hh:mm:ss':
    case 'hh:mm:ss.u':
    case 'hh:mm:ss.uu':
    case 'hh:mm:ss.uuu':
    default:
      return parseClock(text);
  }
}
