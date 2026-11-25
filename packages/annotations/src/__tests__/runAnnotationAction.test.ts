// A list control's action run on the store's current list (#867). The
// actions below are the example page's split and delete
// (website/src/components/examples/AnnotationsExample.tsx), which change the
// annotation objects and the array in place.
import { describe, it, expect } from 'vitest';
import { createAnnotationStore } from '@waveform-playlist/core';
import type { AnnotationAction, AnnotationData } from '@waveform-playlist/core';
import { runAnnotationAction } from '../utils/runAnnotationAction';

const split: AnnotationAction = {
  text: '✂',
  title: 'Split annotation in half',
  action: (annotation, i, annotations) => {
    const halfDuration = (annotation.end - annotation.start) / 2;
    annotations.splice(i + 1, 0, {
      id: `${annotation.id}-split`,
      start: annotation.start + halfDuration,
      end: annotation.end,
      lines: [...annotation.lines],
    });
    annotation.end = annotation.start + halfDuration;
  },
};

const remove: AnnotationAction = {
  text: '🗑',
  title: 'Delete annotation',
  action: (_annotation, i, annotations) => {
    annotations.splice(i, 1);
  },
};

const list = (): AnnotationData[] => [
  { id: 'a', start: 0, end: 2, lines: ['one'] },
  { id: 'b', start: 2, end: 4, lines: ['two'] },
  { id: 'c', start: 4, end: 6, lines: ['three'] },
];

describe('runAnnotationAction', () => {
  it("runs the example's split on a frozen store list", () => {
    const store = createAnnotationStore(list());
    store.update((current) => runAnnotationAction(current, 'b', split, {}));
    const result = store.getAnnotations();
    expect(result.map((a) => [a.id, a.start, a.end])).toEqual([
      ['a', 0, 2],
      ['b', 2, 3],
      ['b-split', 3, 4],
      ['c', 4, 6],
    ]);
  });

  it("runs the example's delete", () => {
    const store = createAnnotationStore(list());
    store.update((current) => runAnnotationAction(current, 'a', remove, {}));
    expect(store.getAnnotations().map((a) => a.id)).toEqual(['b', 'c']);
  });

  it('keeps the objects of the annotations the action did not change', () => {
    const current = createAnnotationStore(list()).getAnnotations();
    const result = runAnnotationAction(current, 'b', split, {});
    expect(result[0]).toBe(current[0]);
    expect(result[3]).toBe(current[2]);
    expect(result[1]).not.toBe(current[1]);
  });

  it('gives the action the position in the current list and the options', () => {
    const seen: unknown[] = [];
    const probe: AnnotationAction = {
      title: 'probe',
      action: (annotation, i, _annotations, opts) => {
        seen.push(annotation.id, i, opts);
      },
    };
    runAnnotationAction(list(), 'c', probe, { linkEndpoints: true });
    expect(seen).toEqual(['c', 2, { linkEndpoints: true }]);
  });

  it('returns the list itself when the id is not in it, or nothing changed', () => {
    const current = list();
    expect(runAnnotationAction(current, 'zz', remove, {})).toBe(current);
    const noop: AnnotationAction = { title: 'noop', action: () => {} };
    expect(runAnnotationAction(current, 'a', noop, {})).toBe(current);
  });
});
