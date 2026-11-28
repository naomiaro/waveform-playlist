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

/** A whole number in plain digits: `String()` switches to exponent notation at 1e21. */
function digits(whole: number): string {
  return whole < 1e21 ? String(whole) : whole.toLocaleString('en-US', { useGrouping: false });
}

/**
 * Format time in clock format (hh:mm:ss with optional decimals).
 *
 * The seconds are rounded as they always were, `(seconds % 60).toFixed(d)`;
 * a rounding that reaches 60 carries into the minutes and hours (59.9996 s is
 * `00:01:00.000`, never `00:00:60.000`). Hours do not wrap at 24.
 */
function clockFormat(seconds: number, decimals: number): string {
  const remainder = seconds % 60;
  const rounded = remainder.toFixed(decimals);
  const carry = Number(rounded) >= 60;
  const totalMinutes = Math.round((seconds - remainder) / 60) + (carry ? 1 : 0);
  const secs = (carry ? (0).toFixed(decimals) : rounded).padStart(
    decimals > 0 ? decimals + 3 : 2,
    '0'
  );

  return (
    digits(Math.floor(totalMinutes / 60)).padStart(2, '0') +
    ':' +
    String(totalMinutes % 60).padStart(2, '0') +
    ':' +
    secs
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

/** A plain non-negative number, or `null`. */
function parseNumber(text: string): number | null {
  if (!DECIMAL.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

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
  return Number.isFinite(total) ? total : null;
}

/**
 * Parse text typed for a time back to seconds, or `null` when it is not a
 * time: empty text, a negative number, letters, a number followed by
 * anything else, a number too large to be finite, or a value that is not a
 * string. Spaces around the text are ignored.
 *
 * The numeric formats (`seconds`, `thousandths`) read a plain number. The
 * clock formats also read the shorter forms `1.5` (seconds) and `1:30`
 * (minutes and seconds) besides `01:02:03.5`.
 */
export function parseTime(timeStr: string, format: TimeFormat): number | null {
  // Plain-JS callers can pass anything.
  if (typeof timeStr !== 'string') return null;
  const text = timeStr.trim();
  switch (format) {
    case 'seconds':
    case 'thousandths':
      return parseNumber(text);
    case 'hh:mm:ss':
    case 'hh:mm:ss.u':
    case 'hh:mm:ss.uu':
    case 'hh:mm:ss.uuu':
    default:
      return parseClock(text);
  }
}
