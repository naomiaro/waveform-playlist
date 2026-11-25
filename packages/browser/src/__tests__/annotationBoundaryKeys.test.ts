// The boundary keys ([, ], {, }) as pure functions (#867). The expected
// results in the fixture were recorded from `useAnnotationKeyboardControls`
// as it was on `dev` before the move (180 cases: three lists, the first three
// annotations, both edges, five deltas, linked and not), so the functions are
// checked to give the same numbers, not reasoned to.
import { describe, it, expect } from 'vitest';
import type { AnnotationData } from '@waveform-playlist/core';
import { moveAnnotationEnd, moveAnnotationStart } from '../utils/annotationBoundaryKeys';
import baseline from './fixtures/annotationBoundaryKeys.baseline.json';

const A = (id: string, start: number, end: number): AnnotationData => ({
  id,
  start,
  end,
  lines: [id],
});
const FIXTURES: Record<string, AnnotationData[]> = {
  linked: [A('a', 0, 1), A('b', 1, 2), A('c', 2, 3), A('d', 3, 4)],
  gaps: [A('a', 0, 1), A('b', 1.5, 2), A('c', 2.02, 3)],
  tight: [A('a', 0, 0.15), A('b', 0.15, 0.3), A('c', 9.9, 10)],
};

interface Case {
  name: string;
  i: number;
  edge: 'start' | 'end';
  d: number;
  link: boolean;
  got: Array<[number, number]>;
}

describe('moveAnnotationStart / moveAnnotationEnd', () => {
  it.each(baseline as Case[])(
    '$name #$i $edge by $d (linked: $link) gives what the hook gave',
    ({ name, i, edge, d, link, got }) => {
      const list = FIXTURES[name];
      const result =
        edge === 'start'
          ? moveAnnotationStart(list, i, d, { linkEndpoints: link })
          : moveAnnotationEnd(list, i, d, { linkEndpoints: link, duration: 10 });
      expect(result.map((a) => [a.start, a.end])).toEqual(got);
    }
  );

  it('keeps every field other than start and end', () => {
    const list = [{ ...A('a', 0, 1), language: 'en' }, A('b', 1, 2)];
    const [a] = moveAnnotationEnd(list, 0, 0.01, { linkEndpoints: true, duration: 10 });
    expect(a).toMatchObject({ id: 'a', lines: ['a'], language: 'en' });
  });

  it('does not change its input', () => {
    const list = Object.freeze([Object.freeze(A('a', 0, 1)), Object.freeze(A('b', 1, 2))]);
    expect(() => moveAnnotationStart(list, 1, 0.01, { linkEndpoints: true })).not.toThrow();
    expect(list[1].start).toBe(1);
  });
});
