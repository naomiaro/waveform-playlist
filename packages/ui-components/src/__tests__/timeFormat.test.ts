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

  describe('hours do not wrap at 24', () => {
    it('prints 86400 seconds as 24:00:00', () => {
      expect(formatTime(86400, 'hh:mm:ss')).toBe('24:00:00');
    });

    it('prints 90061 seconds as 25:01:01', () => {
      expect(formatTime(90061, 'hh:mm:ss')).toBe('25:01:01');
    });
  });

  describe('rounding carries into the minutes and hours (#815)', () => {
    it('carries 59.9996 s into the next minute', () => {
      expect(formatTime(59.9996, 'hh:mm:ss.uuu')).toBe('00:01:00.000');
    });

    it('carries 59.7 s into the next minute without decimals', () => {
      expect(formatTime(59.7, 'hh:mm:ss')).toBe('00:01:00');
    });

    it('carries 3599.96 s into the next hour', () => {
      expect(formatTime(3599.96, 'hh:mm:ss.u')).toBe('01:00:00.0');
    });

    it('keeps a value just under the rounding point in its minute', () => {
      expect(formatTime(59.9994, 'hh:mm:ss.uuu')).toBe('00:00:59.999');
    });
  });

  describe('a negative or non-finite time prints as zero', () => {
    it('clamps a negative clock time', () => {
      expect(formatTime(-0.4, 'hh:mm:ss.uuu')).toBe('00:00:00.000');
    });

    it('clamps a negative time in the numeric formats', () => {
      expect(formatTime(-3, 'seconds')).toBe('0');
      expect(formatTime(-0.0001, 'thousandths')).toBe('0.000');
    });

    it('prints NaN and Infinity as zero', () => {
      expect(formatTime(NaN, 'thousandths')).toBe('0.000');
      expect(formatTime(Infinity, 'hh:mm:ss')).toBe('00:00:00');
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

    it('parses a leading decimal point', () => {
      expect(parseTime('.5', 'seconds')).toBe(0.5);
    });

    it('returns null for invalid string', () => {
      expect(parseTime('abc', 'seconds')).toBeNull();
    });

    it('returns null for a number followed by other text', () => {
      expect(parseTime('1.5abc', 'seconds')).toBeNull();
      expect(parseTime('1:30', 'seconds')).toBeNull();
    });

    it('returns null for a negative number', () => {
      expect(parseTime('-5', 'seconds')).toBeNull();
    });

    it('returns null for exponent notation', () => {
      expect(parseTime('1e3', 'seconds')).toBeNull();
    });
  });

  describe('thousandths format', () => {
    it('parses decimal string', () => {
      expect(parseTime('1.500', 'thousandths')).toBe(1.5);
    });

    it('parses zero', () => {
      expect(parseTime('0.000', 'thousandths')).toBe(0);
    });

    it('ignores surrounding spaces', () => {
      expect(parseTime(' 2.25 ', 'thousandths')).toBe(2.25);
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

    it('returns null for invalid format', () => {
      expect(parseTime('invalid', 'hh:mm:ss')).toBeNull();
    });

    it('returns null for more than three parts', () => {
      expect(parseTime('1:00:00:00', 'hh:mm:ss')).toBeNull();
    });

    it('returns null for a part that is not a number', () => {
      expect(parseTime('ab:00:05', 'hh:mm:ss')).toBeNull();
      expect(parseTime('00::05', 'hh:mm:ss')).toBeNull();
    });

    it('returns null for minutes or seconds of 60 or more after a larger part', () => {
      expect(parseTime('00:75:00', 'hh:mm:ss')).toBeNull();
      expect(parseTime('00:00:60', 'hh:mm:ss')).toBeNull();
      expect(parseTime('1:60', 'hh:mm:ss')).toBeNull();
    });

    it('returns null for a decimal point before the last part', () => {
      expect(parseTime('1.5:00', 'hh:mm:ss')).toBeNull();
    });

    it('returns null for a negative time', () => {
      expect(parseTime('-00:00:05', 'hh:mm:ss')).toBeNull();
      expect(parseTime('-5', 'hh:mm:ss')).toBeNull();
    });
  });

  describe('shorter forms in the clock formats (#717)', () => {
    it('reads a plain number as seconds', () => {
      expect(parseTime('1.5', 'hh:mm:ss.uuu')).toBe(1.5);
      expect(parseTime('90', 'hh:mm:ss')).toBe(90);
    });

    it('reads two parts as minutes and seconds', () => {
      expect(parseTime('1:30', 'hh:mm:ss')).toBe(90);
      expect(parseTime('0:59.999', 'hh:mm:ss.uuu')).toBe(59.999);
    });

    it('lets the first part be any size', () => {
      expect(parseTime('120:00', 'hh:mm:ss')).toBe(7200);
      expect(parseTime('30:00:00', 'hh:mm:ss')).toBe(108000);
    });

    it('reads one-digit parts in the full form', () => {
      expect(parseTime('1:02:03.5', 'hh:mm:ss.u')).toBe(3723.5);
      expect(parseTime('1:2:3', 'hh:mm:ss')).toBe(3723);
    });

    it('ignores surrounding spaces', () => {
      expect(parseTime(' 1:30 ', 'hh:mm:ss')).toBe(90);
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

  describe('empty or blank input', () => {
    const formats: TimeFormat[] = [
      'seconds',
      'thousandths',
      'hh:mm:ss',
      'hh:mm:ss.u',
      'hh:mm:ss.uu',
      'hh:mm:ss.uuu',
    ];

    for (const format of formats) {
      it(`returns null for empty or blank text with format "${format}"`, () => {
        expect(parseTime('', format)).toBeNull();
        expect(parseTime('   ', format)).toBeNull();
      });
    }
  });
});

/** `parseTime` for text that must be a time: fails the test on `null`. */
const parseOrFail = (text: string, format: TimeFormat): number => {
  const seconds = parseTime(text, format);
  if (seconds === null) throw new Error(`"${text}" did not parse as ${format}`);
  return seconds;
};

describe('round-trip: formatTime(parseTime(str)) === str', () => {
  it('round-trips seconds format', () => {
    const str = '42';
    expect(formatTime(parseOrFail(str, 'seconds'), 'seconds')).toBe(str);
  });

  it('round-trips thousandths format', () => {
    const str = '1.500';
    expect(formatTime(parseOrFail(str, 'thousandths'), 'thousandths')).toBe(str);
  });

  it('round-trips hh:mm:ss format', () => {
    const str = '01:02:03';
    expect(formatTime(parseOrFail(str, 'hh:mm:ss'), 'hh:mm:ss')).toBe(str);
  });

  it('round-trips hh:mm:ss.u format', () => {
    const str = '01:02:03.4';
    expect(formatTime(parseOrFail(str, 'hh:mm:ss.u'), 'hh:mm:ss.u')).toBe(str);
  });

  it('round-trips hh:mm:ss.uu format', () => {
    const str = '01:02:03.45';
    expect(formatTime(parseOrFail(str, 'hh:mm:ss.uu'), 'hh:mm:ss.uu')).toBe(str);
  });

  it('round-trips hh:mm:ss.uuu format', () => {
    const str = '02:03:04.123';
    expect(formatTime(parseOrFail(str, 'hh:mm:ss.uuu'), 'hh:mm:ss.uuu')).toBe(str);
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

describe('formatTime prints what it printed before #815, except at a carry', () => {
  // The clock formatter before #815: seconds rounded alone, hours wrapped at 24.
  const before = (seconds: number, decimals: number): string => {
    const hours = Math.floor(seconds / 3600) % 24;
    const minutes = Math.floor(seconds / 60) % 60;
    const secs = (seconds % 60).toFixed(decimals);
    return (
      String(hours).padStart(2, '0') +
      ':' +
      String(minutes).padStart(2, '0') +
      ':' +
      secs.padStart(decimals > 0 ? decimals + 3 : 2, '0')
    );
  };
  const clockFormats: Array<[TimeFormat, number]> = [
    ['hh:mm:ss', 0],
    ['hh:mm:ss.u', 1],
    ['hh:mm:ss.uu', 2],
    ['hh:mm:ss.uuu', 3],
  ];

  it('matches the old output for every value below 24 h whose old output had no 60', () => {
    const values: number[] = [];
    // Every 1/8 s up to 24 h, values near each minute boundary, and decimal halves.
    for (let i = 0; i < 86_400 * 8; i += 7) values.push(i / 8);
    for (let m = 1; m < 1440; m += 13) {
      for (const d of [1e-4, 4e-4, 5e-4, 6e-4, 5e-3, 0.05, 0.5]) values.push(m * 60 - d);
    }
    for (let i = 0; i < 20_000; i++) values.push(i * 4.3205 + 0.0005);
    let compared = 0;
    let carried = 0;
    for (const value of values) {
      if (value >= 86_399.5) continue;
      for (const [format, decimals] of clockFormats) {
        const old = before(value, decimals);
        if (/:60(\.|$)/.test(old)) {
          carried++;
          continue;
        }
        compared++;
        if (formatTime(value, format) !== old) {
          throw new Error(`${value} ${format}: ${formatTime(value, format)} !== ${old}`);
        }
      }
    }
    // The fixture reaches the broken case too, or it proves nothing about it.
    expect(carried).toBeGreaterThan(0);
    expect(compared).toBeGreaterThan(100_000);
  });
});

describe('edges found in review of #951', () => {
  it('prints digits, never exponent notation, for a time of 1e21 s or more', () => {
    expect(formatTime(1.08e21, 'hh:mm:ss.uuu')).toMatch(/^\d+:\d{2}:\d{2}\.\d{3}$/);
    expect(formatTime(1e21, 'hh:mm:ss.uuu')).toMatch(/^\d+:\d{2}:\d{2}\.\d{3}$/);
    expect(formatTime(3.6e26, 'hh:mm:ss')).toMatch(/^\d+:\d{2}:\d{2}$/);
    expect(formatTime(1e21, 'seconds')).toMatch(/^\d+$/);
    expect(formatTime(1e21, 'thousandths')).toMatch(/^\d+\.\d{3}$/);
  });

  it('returns null for a number too large to be finite', () => {
    const digits = '1'.repeat(400);
    expect(parseTime(digits, 'seconds')).toBeNull();
    expect(parseTime(digits, 'hh:mm:ss')).toBeNull();
    expect(parseTime(`${digits}:00:00`, 'hh:mm:ss')).toBeNull();
  });

  // CodeQL on #951: `\d+\.?\d*` can split a run of digits in many ways, so a
  // long digit string that fails at its end backtracked in quadratic time.
  it('refuses a long digit string with a bad ending in linear time', () => {
    const text = '9'.repeat(50_000) + 'x';
    const started = performance.now();
    expect(parseTime(text, 'seconds')).toBeNull();
    expect(parseTime(text, 'hh:mm:ss')).toBeNull();
    expect(performance.now() - started).toBeLessThan(200);
  });

  it('returns null for a value that is not a string (plain JS)', () => {
    expect(parseTime(undefined as unknown as string, 'seconds')).toBeNull();
    expect(parseTime(null as unknown as string, 'hh:mm:ss')).toBeNull();
  });
});
