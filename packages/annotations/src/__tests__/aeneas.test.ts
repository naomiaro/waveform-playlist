import { describe, it, expect } from 'vitest';
import { parseAeneas, serializeAeneas } from '../parsers/aeneas';
import type { AeneasFragment } from '../parsers/aeneas';
import type { AnnotationData } from '@waveform-playlist/core';

describe('parseAeneas', () => {
  it('converts an AeneasFragment to AnnotationData', () => {
    const fragment: AeneasFragment = {
      begin: '1.000',
      end: '5.500',
      id: 'f001',
      language: 'en',
      lines: ['Hello world'],
    };

    const result = parseAeneas(fragment);

    expect(result).toEqual({
      id: 'f001',
      start: 1.0,
      end: 5.5,
      lines: ['Hello world'],
      language: 'en',
    });
  });

  it('handles multiple lines', () => {
    const fragment: AeneasFragment = {
      begin: '0.000',
      end: '2.000',
      id: 'f002',
      language: 'fr',
      lines: ['Line one', 'Line two', 'Line three'],
    };

    const result = parseAeneas(fragment);

    expect(result.lines).toEqual(['Line one', 'Line two', 'Line three']);
    expect(result.language).toBe('fr');
  });

  it('parses begin/end as floats', () => {
    const fragment: AeneasFragment = {
      begin: '10.123',
      end: '20.456',
      id: 'f003',
      language: 'en',
      lines: ['Test'],
    };

    const result = parseAeneas(fragment);

    expect(result.start).toBe(10.123);
    expect(result.end).toBe(20.456);
  });

  it('handles zero times', () => {
    const fragment: AeneasFragment = {
      begin: '0.000',
      end: '0.000',
      id: 'f004',
      language: 'en',
      lines: [],
    };

    const result = parseAeneas(fragment);

    expect(result.start).toBe(0);
    expect(result.end).toBe(0);
    expect(result.lines).toEqual([]);
  });

  it('handles special characters in text', () => {
    const fragment: AeneasFragment = {
      begin: '1.000',
      end: '2.000',
      id: 'f005',
      language: 'en',
      lines: ['Hello & goodbye', '<tag>', '"quoted"', "it's"],
    };

    const result = parseAeneas(fragment);

    expect(result.lines).toEqual(['Hello & goodbye', '<tag>', '"quoted"', "it's"]);
  });
});

describe('serializeAeneas', () => {
  it('converts AnnotationData to AeneasFragment', () => {
    const annotation: AnnotationData = {
      id: 'a001',
      start: 1.0,
      end: 5.5,
      lines: ['Hello world'],
      language: 'en',
    };

    const result = serializeAeneas(annotation);

    expect(result).toEqual({
      id: 'a001',
      begin: '1.000',
      end: '5.500',
      lines: ['Hello world'],
      language: 'en',
    });
  });

  it('formats begin/end to three decimal places', () => {
    const annotation: AnnotationData = {
      id: 'a002',
      start: 1,
      end: 2,
      lines: ['Test'],
      language: 'en',
    };

    const result = serializeAeneas(annotation);

    expect(result.begin).toBe('1.000');
    expect(result.end).toBe('2.000');
  });

  it('defaults language to "en" when undefined', () => {
    const annotation: AnnotationData = {
      id: 'a003',
      start: 0,
      end: 1,
      lines: ['Test'],
    };

    const result = serializeAeneas(annotation);

    expect(result.language).toBe('en');
  });

  it('preserves explicit language', () => {
    const annotation: AnnotationData = {
      id: 'a004',
      start: 0,
      end: 1,
      lines: ['Bonjour'],
      language: 'fr',
    };

    const result = serializeAeneas(annotation);

    expect(result.language).toBe('fr');
  });

  it('handles empty lines array', () => {
    const annotation: AnnotationData = {
      id: 'a005',
      start: 0,
      end: 0,
      lines: [],
    };

    const result = serializeAeneas(annotation);

    expect(result.lines).toEqual([]);
  });
});

describe('round-trip: parseAeneas(serializeAeneas(data)) preserves data', () => {
  it('round-trips a full annotation', () => {
    const original: AnnotationData = {
      id: 'rt001',
      start: 1.234,
      end: 5.678,
      lines: ['Hello', 'World'],
      language: 'en',
    };

    const roundTripped = parseAeneas(serializeAeneas(original));

    expect(roundTripped.id).toBe(original.id);
    expect(roundTripped.start).toBeCloseTo(original.start, 3);
    expect(roundTripped.end).toBeCloseTo(original.end, 3);
    expect(roundTripped.lines).toEqual(original.lines);
    expect(roundTripped.language).toBe(original.language);
  });

  it('round-trips a single annotation with no language', () => {
    const original: AnnotationData = {
      id: 'rt002',
      start: 0,
      end: 10,
      lines: ['Only line'],
    };

    const roundTripped = parseAeneas(serializeAeneas(original));

    expect(roundTripped.id).toBe(original.id);
    expect(roundTripped.start).toBe(original.start);
    expect(roundTripped.end).toBe(original.end);
    expect(roundTripped.lines).toEqual(original.lines);
    // serializeAeneas defaults to 'en', so round-trip adds language
    expect(roundTripped.language).toBe('en');
  });

  it('round-trips zero-length annotation', () => {
    const original: AnnotationData = {
      id: 'rt003',
      start: 0,
      end: 0,
      lines: [],
      language: 'de',
    };

    const roundTripped = parseAeneas(serializeAeneas(original));

    expect(roundTripped.start).toBe(0);
    expect(roundTripped.end).toBe(0);
    expect(roundTripped.lines).toEqual([]);
  });
});

describe('round-trip: serializeAeneas(parseAeneas(fragment)) preserves data', () => {
  it('round-trips a fragment', () => {
    const original: AeneasFragment = {
      begin: '3.141',
      end: '6.283',
      id: 'frt001',
      language: 'es',
      lines: ['Hola mundo'],
    };

    const roundTripped = serializeAeneas(parseAeneas(original));

    expect(roundTripped).toEqual(original);
  });

  it('round-trips with special characters', () => {
    const original: AeneasFragment = {
      begin: '0.000',
      end: '1.000',
      id: 'frt002',
      language: 'en',
      lines: ['Line with "quotes" & <symbols>'],
    };

    const roundTripped = serializeAeneas(parseAeneas(original));

    expect(roundTripped).toEqual(original);
  });
});
