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

  it('returns 0 for garbage or empty input', () => {
    expect(parseDisplayTime('', 'hh:mm:ss.sss')).toBe(0);
    expect(parseDisplayTime('not-a-time', 'seconds')).toBe(0);
    expect(parseDisplayTime('1:2', 'hh:mm:ss')).toBe(0); // needs 3 segments
  });

  it('clamps negative parse results to 0', () => {
    expect(parseDisplayTime('-10', 'seconds')).toBe(0);
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
