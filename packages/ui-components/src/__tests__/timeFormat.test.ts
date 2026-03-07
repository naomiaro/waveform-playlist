import { describe, it, expect } from 'vitest';
import { formatTime, parseTime } from '../utils/timeFormat';
import type { TimeFormat } from '../utils/timeFormat';

describe('formatTime', () => {
  describe('seconds format', () => {
    it('formats zero', () => {
      expect(formatTime(0, 'seconds')).toBe('0');
    });

    it('rounds to integer', () => {
      expect(formatTime(3.7, 'seconds')).toBe('4');
    });

    it('formats whole number', () => {
      expect(formatTime(42, 'seconds')).toBe('42');
    });

    it('formats large values', () => {
      expect(formatTime(86400, 'seconds')).toBe('86400');
    });
  });

  describe('thousandths format', () => {
    it('formats zero with decimals', () => {
      expect(formatTime(0, 'thousandths')).toBe('0.000');
    });

    it('formats with three decimal places', () => {
      expect(formatTime(1.5, 'thousandths')).toBe('1.500');
    });

    it('truncates beyond three decimals', () => {
      expect(formatTime(1.23456, 'thousandths')).toBe('1.235');
    });

    it('formats large values', () => {
      expect(formatTime(9999.999, 'thousandths')).toBe('9999.999');
    });
  });

  describe('hh:mm:ss format', () => {
    it('formats zero', () => {
      expect(formatTime(0, 'hh:mm:ss')).toBe('00:00:00');
    });

    it('formats seconds only', () => {
      expect(formatTime(5, 'hh:mm:ss')).toBe('00:00:05');
    });

    it('formats minutes and seconds', () => {
      expect(formatTime(65, 'hh:mm:ss')).toBe('00:01:05');
    });

    it('formats hours, minutes, and seconds', () => {
      expect(formatTime(3661, 'hh:mm:ss')).toBe('01:01:01');
    });

    it('rounds fractional seconds', () => {
      expect(formatTime(1.7, 'hh:mm:ss')).toBe('00:00:02');
    });
  });

  describe('hh:mm:ss.u format', () => {
    it('formats zero', () => {
      expect(formatTime(0, 'hh:mm:ss.u')).toBe('00:00:00.0');
    });

    it('formats with one decimal place', () => {
      expect(formatTime(1.56, 'hh:mm:ss.u')).toBe('00:00:01.6');
    });

    it('formats full time', () => {
      expect(formatTime(3723.4, 'hh:mm:ss.u')).toBe('01:02:03.4');
    });
  });

  describe('hh:mm:ss.uu format', () => {
    it('formats zero', () => {
      expect(formatTime(0, 'hh:mm:ss.uu')).toBe('00:00:00.00');
    });

    it('formats with two decimal places', () => {
      expect(formatTime(1.567, 'hh:mm:ss.uu')).toBe('00:00:01.57');
    });
  });

  describe('hh:mm:ss.uuu format', () => {
    it('formats zero', () => {
      expect(formatTime(0, 'hh:mm:ss.uuu')).toBe('00:00:00.000');
    });

    it('formats with three decimal places', () => {
      expect(formatTime(1.5678, 'hh:mm:ss.uuu')).toBe('00:00:01.568');
    });

    it('formats complex time', () => {
      expect(formatTime(7384.123, 'hh:mm:ss.uuu')).toBe('02:03:04.123');
    });
  });

  describe('wraps hours at 24', () => {
    it('wraps 86400 seconds (24h) to 00', () => {
      expect(formatTime(86400, 'hh:mm:ss')).toBe('00:00:00');
    });

    it('wraps 90061 seconds (25h 1m 1s) to 01:01:01', () => {
      expect(formatTime(90061, 'hh:mm:ss')).toBe('01:01:01');
    });
  });
});

describe('parseTime', () => {
  describe('seconds format', () => {
    it('parses integer string', () => {
      expect(parseTime('42', 'seconds')).toBe(42);
    });

    it('parses float string', () => {
      expect(parseTime('3.5', 'seconds')).toBe(3.5);
    });

    it('returns 0 for empty string', () => {
      expect(parseTime('', 'seconds')).toBe(0);
    });

    it('returns 0 for invalid string', () => {
      expect(parseTime('abc', 'seconds')).toBe(0);
    });
  });

  describe('thousandths format', () => {
    it('parses decimal string', () => {
      expect(parseTime('1.500', 'thousandths')).toBe(1.5);
    });

    it('parses zero', () => {
      expect(parseTime('0.000', 'thousandths')).toBe(0);
    });

    it('returns 0 for empty string', () => {
      expect(parseTime('', 'thousandths')).toBe(0);
    });
  });

  describe('hh:mm:ss format', () => {
    it('parses zero', () => {
      expect(parseTime('00:00:00', 'hh:mm:ss')).toBe(0);
    });

    it('parses seconds', () => {
      expect(parseTime('00:00:05', 'hh:mm:ss')).toBe(5);
    });

    it('parses minutes and seconds', () => {
      expect(parseTime('00:01:05', 'hh:mm:ss')).toBe(65);
    });

    it('parses hours, minutes, seconds', () => {
      expect(parseTime('01:01:01', 'hh:mm:ss')).toBe(3661);
    });

    it('returns 0 for invalid format', () => {
      expect(parseTime('invalid', 'hh:mm:ss')).toBe(0);
    });

    it('returns 0 for wrong number of parts', () => {
      expect(parseTime('00:00', 'hh:mm:ss')).toBe(0);
    });
  });

  describe('hh:mm:ss.uuu format', () => {
    it('parses with milliseconds', () => {
      expect(parseTime('00:00:01.500', 'hh:mm:ss.uuu')).toBe(1.5);
    });

    it('parses complex time', () => {
      expect(parseTime('02:03:04.123', 'hh:mm:ss.uuu')).toBe(7384.123);
    });
  });

  describe('empty/falsy input', () => {
    const formats: TimeFormat[] = [
      'seconds',
      'thousandths',
      'hh:mm:ss',
      'hh:mm:ss.u',
      'hh:mm:ss.uu',
      'hh:mm:ss.uuu',
    ];

    for (const format of formats) {
      it(`returns 0 for empty string with format "${format}"`, () => {
        expect(parseTime('', format)).toBe(0);
      });
    }
  });
});

describe('round-trip: formatTime(parseTime(str)) === str', () => {
  it('round-trips seconds format', () => {
    const str = '42';
    expect(formatTime(parseTime(str, 'seconds'), 'seconds')).toBe(str);
  });

  it('round-trips thousandths format', () => {
    const str = '1.500';
    expect(formatTime(parseTime(str, 'thousandths'), 'thousandths')).toBe(str);
  });

  it('round-trips hh:mm:ss format', () => {
    const str = '01:02:03';
    expect(formatTime(parseTime(str, 'hh:mm:ss'), 'hh:mm:ss')).toBe(str);
  });

  it('round-trips hh:mm:ss.u format', () => {
    const str = '01:02:03.4';
    expect(formatTime(parseTime(str, 'hh:mm:ss.u'), 'hh:mm:ss.u')).toBe(str);
  });

  it('round-trips hh:mm:ss.uu format', () => {
    const str = '01:02:03.45';
    expect(formatTime(parseTime(str, 'hh:mm:ss.uu'), 'hh:mm:ss.uu')).toBe(str);
  });

  it('round-trips hh:mm:ss.uuu format', () => {
    const str = '02:03:04.123';
    expect(formatTime(parseTime(str, 'hh:mm:ss.uuu'), 'hh:mm:ss.uuu')).toBe(str);
  });
});

describe('round-trip: parseTime(formatTime(n)) === n', () => {
  it('round-trips zero', () => {
    expect(parseTime(formatTime(0, 'hh:mm:ss.uuu'), 'hh:mm:ss.uuu')).toBe(0);
  });

  it('round-trips whole seconds', () => {
    // formatTime(3661, 'hh:mm:ss') => '01:01:001', parseTime parses back to 3661
    expect(parseTime(formatTime(3661, 'hh:mm:ss'), 'hh:mm:ss')).toBe(3661);
  });

  it('round-trips fractional seconds', () => {
    const value = 7384.123;
    expect(parseTime(formatTime(value, 'hh:mm:ss.uuu'), 'hh:mm:ss.uuu')).toBeCloseTo(value, 3);
  });
});
