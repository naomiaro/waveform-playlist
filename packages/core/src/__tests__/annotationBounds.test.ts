import { describe, it, expect } from 'vitest';
import { applyAnnotationBounds } from '../annotations/bounds';
import type { AnnotationData } from '../types';

const a: AnnotationData = { id: 'a', start: 0, end: 1, lines: ['first'], language: 'en' };
const b: AnnotationData = { id: 'b', start: 1, end: 2, lines: ['second'] };
const c: AnnotationData = { id: 'c', start: 2, end: 3, lines: ['third'] };

describe('applyAnnotationBounds', () => {
  it('writes start and end by id and keeps every other field', () => {
    const result = applyAnnotationBounds([a, b, c], [{ id: 'b', start: 1.5, end: 2.5 }]);
    expect(result[1]).toEqual({ id: 'b', start: 1.5, end: 2.5, lines: ['second'] });
  });

  it('keeps every untouched annotation object', () => {
    const result = applyAnnotationBounds([a, b, c], [{ id: 'b', start: 1.5, end: 2.5 }]);
    expect(result[0]).toBe(a);
    expect(result[2]).toBe(c);
  });

  it('skips an id that is not in the list', () => {
    const result = applyAnnotationBounds(
      [a, c],
      [
        { id: 'b', start: 9, end: 10 },
        { id: 'c', start: 2, end: 4 },
      ]
    );
    expect(result.map((x) => x.id)).toEqual(['a', 'c']);
    expect(result[1].end).toBe(4);
  });

  it('returns the list itself when no change applies', () => {
    const list = [a, b];
    expect(applyAnnotationBounds(list, [{ id: 'zz', start: 0, end: 1 }])).toBe(list);
    expect(applyAnnotationBounds(list, [])).toBe(list);
  });

  it('returns the list itself when the bounds are already those', () => {
    const list = [a, b];
    expect(applyAnnotationBounds(list, [{ id: 'a', start: 0, end: 1 }])).toBe(list);
  });
});
