import { describe, it, expect } from 'vitest';
import {
  TIME_DISPLAY_FORMATS,
  isTimeDisplayFormat,
  formatDisplayTime,
  parseDisplayTime,
} from '../utils/time-display-format';

describe('time-display-format', () => {
  it('exposes the three spec formats in order', () => {
    expect(TIME_DISPLAY_FORMATS).toEqual(['hh:mm:ss.sss', 'hh:mm:ss', 'seconds']);
  });

  it('isTimeDisplayFormat guards correctly', () => {
    expect(isTimeDisplayFormat('hh:mm:ss')).toBe(true);
    expect(isTimeDisplayFormat('hh:mm:ss.uuu')).toBe(false);
    expect(isTimeDisplayFormat(undefined)).toBe(false);
    expect(isTimeDisplayFormat(3)).toBe(false);
  });

  it('formats hh:mm:ss.sss with zero padding and milliseconds', () => {
    expect(formatDisplayTime(0, 'hh:mm:ss.sss')).toBe('00:00:00.000');
    expect(formatDisplayTime(65.5, 'hh:mm:ss.sss')).toBe('00:01:05.500');
    expect(formatDisplayTime(3661.25, 'hh:mm:ss.sss')).toBe('01:01:01.250');
  });

  it('formats hh:mm:ss without decimals', () => {
    expect(formatDisplayTime(65.5, 'hh:mm:ss')).toBe('00:01:05');
    expect(formatDisplayTime(7322, 'hh:mm:ss')).toBe('02:02:02');
  });

  it('formats seconds as a plain fixed-point number', () => {
    expect(formatDisplayTime(65.5, 'seconds')).toBe('65.500');
    expect(formatDisplayTime(0, 'seconds')).toBe('0.000');
  });

  it('does not wrap hours at 24 (long audiobooks)', () => {
    expect(formatDisplayTime(25 * 3600, 'hh:mm:ss')).toBe('25:00:00');
  });

  it('clamps NaN, Infinity, and negative input to 0', () => {
    expect(formatDisplayTime(NaN, 'hh:mm:ss.sss')).toBe('00:00:00.000');
    expect(formatDisplayTime(Infinity, 'hh:mm:ss')).toBe('00:00:00');
    expect(formatDisplayTime(-5, 'seconds')).toBe('0.000');
  });

  it('parses clock formats back to seconds', () => {
    expect(parseDisplayTime('00:01:05.500', 'hh:mm:ss.sss')).toBeCloseTo(65.5);
    expect(parseDisplayTime('01:01:01', 'hh:mm:ss')).toBe(3661);
  });

  it('parses seconds format', () => {
    expect(parseDisplayTime('65.5', 'seconds')).toBeCloseTo(65.5);
  });

  it('round-trips format -> parse for every format', () => {
    for (const format of TIME_DISPLAY_FORMATS) {
      const formatted = formatDisplayTime(125.25, format);
      const expected = format === 'hh:mm:ss' ? 125 : 125.25;
      expect(parseDisplayTime(formatted, format)).toBeCloseTo(expected);
    }
  });

  it('returns null for text that is not a time', () => {
    expect(parseDisplayTime('', 'hh:mm:ss.sss')).toBeNull();
    expect(parseDisplayTime('   ', 'seconds')).toBeNull();
    expect(parseDisplayTime('not-a-time', 'seconds')).toBeNull();
    expect(parseDisplayTime('1.5abc', 'seconds')).toBeNull();
    expect(parseDisplayTime('1:30', 'seconds')).toBeNull();
    expect(parseDisplayTime('ab:00:05', 'hh:mm:ss')).toBeNull();
    expect(parseDisplayTime('1:00:00:00', 'hh:mm:ss')).toBeNull();
    expect(parseDisplayTime('1.5:00', 'hh:mm:ss.sss')).toBeNull();
  });

  it('returns null for minutes or seconds of 60 or more after a larger part', () => {
    expect(parseDisplayTime('00:75:00', 'hh:mm:ss')).toBeNull();
    expect(parseDisplayTime('1:60', 'hh:mm:ss.sss')).toBeNull();
  });

  it('returns null for a negative time', () => {
    expect(parseDisplayTime('-10', 'seconds')).toBeNull();
    expect(parseDisplayTime('-00:00:05', 'hh:mm:ss')).toBeNull();
  });

  it('returns null for a number too large to be finite, and for a value that is not a string', () => {
    expect(parseDisplayTime('1'.repeat(400), 'seconds')).toBeNull();
    expect(parseDisplayTime('1'.repeat(400), 'hh:mm:ss')).toBeNull();
    expect(parseDisplayTime(undefined as unknown as string, 'seconds')).toBeNull();
  });

  it('refuses a long digit string with a bad ending in linear time (CodeQL on #951)', () => {
    const text = '9'.repeat(50_000) + 'x';
    const started = performance.now();
    expect(parseDisplayTime(text, 'seconds')).toBeNull();
    expect(parseDisplayTime(text, 'hh:mm:ss')).toBeNull();
    expect(performance.now() - started).toBeLessThan(200);
  });

  it('reads the shorter forms in the clock formats', () => {
    expect(parseDisplayTime('1.5', 'hh:mm:ss.sss')).toBe(1.5);
    expect(parseDisplayTime('1:30', 'hh:mm:ss')).toBe(90);
    expect(parseDisplayTime('1:2', 'hh:mm:ss')).toBe(62);
    expect(parseDisplayTime('120:00', 'hh:mm:ss')).toBe(7200);
    expect(parseDisplayTime(' 1:02:03.5 ', 'hh:mm:ss.sss')).toBe(3723.5);
  });

  it('truncates instead of rounding across the minute boundary', () => {
    expect(formatDisplayTime(59.9999, 'hh:mm:ss.sss')).toBe('00:00:59.999');
    expect(formatDisplayTime(119.99999, 'hh:mm:ss.sss')).toBe('00:01:59.999');
  });

  it('does not render stored decimal values 1ms low (float truncation)', () => {
    expect(formatDisplayTime(1.001, 'hh:mm:ss.sss')).toBe('00:00:01.001');
    expect(formatDisplayTime(75.345, 'hh:mm:ss.sss')).toBe('00:01:15.345');
  });

  it('still truncates at the minute boundary after the epsilon', () => {
    expect(formatDisplayTime(59.9999, 'hh:mm:ss.sss')).toBe('00:00:59.999');
    expect(formatDisplayTime(59.99999999, 'hh:mm:ss.sss')).toBe('00:00:59.999');
  });
});
