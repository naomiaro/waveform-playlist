// @vitest-environment jsdom
//
// #704 close-out. Two things about dragging an annotation edge:
// - Escape restores every annotation the drag moved, not only the dragged one
//   (a linked or pushed neighbour used to stay where the drag had put it).
// - With a `preview` source the moves are published there and the store
//   changes once, on release. Without one it changes on every move.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { DragStartEvent, DragMoveEvent, DragEndEvent } from '@dnd-kit/abstract';
import {
  createAnnotationStore,
  createValueSource,
  type AnnotationData,
  type AnnotationStore,
  type AnnotationStoreOptions,
} from '@waveform-playlist/core';
import { useAnnotationDragHandlers } from '../hooks/useAnnotationDragHandlers';

// 1 px = 0.01 s
const SAMPLE_RATE = 1000;
const SAMPLES_PER_PIXEL = 10;

const annotation = (id: string, start: number, end: number): AnnotationData =>
  ({ id, start, end, lines: [id] }) as AnnotationData;

const initial = () => [annotation('a', 0, 1), annotation('b', 1, 2), annotation('c', 3, 4)];

const source = (annotationIndex: number, edge: 'start' | 'end') => ({
  data: { annotationId: 'x', annotationIndex, edge },
});

const startEvent = (annotationIndex: number, edge: 'start' | 'end') =>
  ({ operation: { source: source(annotationIndex, edge) } }) as unknown as DragStartEvent;

const moveEvent = (annotationIndex: number, edge: 'start' | 'end', px: number) =>
  ({
    operation: {
      source: source(annotationIndex, edge),
      position: { initial: { x: 100 }, current: { x: 100 } },
    },
    to: { x: 100 + px, y: 0 },
  }) as unknown as DragMoveEvent;

const endEvent = (canceled: boolean) => ({ canceled }) as unknown as DragEndEvent;

function setup(options: { preview?: boolean } = {}) {
  const preview = createValueSource<AnnotationData[] | null>(null);
  // The store owns the annotations (#867); `storeChanges` counts its changes.
  const store = createAnnotationStore(initial());
  const storeChanges = vi.fn();
  store.subscribe(storeChanges);
  const view = renderHook(() =>
    useAnnotationDragHandlers({
      store,
      samplesPerPixel: SAMPLES_PER_PIXEL,
      sampleRate: SAMPLE_RATE,
      duration: 10,
      linkEndpoints: true,
      preview: options.preview ? preview : undefined,
    })
  );
  const run = (fn: (handlers: typeof view.result.current) => void) => {
    act(() => fn(view.result.current));
    view.rerender();
  };
  return {
    run,
    storeChanges,
    preview,
    current: () => store.getAnnotations(),
    unmount: view.unmount,
  };
}

const times = (list: readonly AnnotationData[]) => list.map((a) => [a.start, a.end]);

describe('useAnnotationDragHandlers', () => {
  afterEach(() => cleanup());

  describe('without a preview source', () => {
    it('reports every move', () => {
      const { run, storeChanges, current } = setup();

      run((h) => h.onDragStart(startEvent(0, 'end')));
      run((h) => h.onDragMove(moveEvent(0, 'end', 30)));
      run((h) => h.onDragMove(moveEvent(0, 'end', 50)));

      expect(storeChanges).toHaveBeenCalledTimes(2);
      // The linked neighbour's start follows the dragged end.
      expect(times(current())).toEqual([
        [0, 1.5],
        [1.5, 2],
        [3, 4],
      ]);
    });

    it('Escape restores every annotation the drag moved', () => {
      const { run, current } = setup();
      const before = current();

      run((h) => h.onDragStart(startEvent(0, 'end')));
      run((h) => h.onDragMove(moveEvent(0, 'end', 50)));
      expect(current()[1].start).toBe(1.5);
      run((h) => h.onDragEnd(endEvent(true)));

      expect(times(current())).toEqual(times(before));
    });

    // #747: with linked endpoints, an edge dragged into a separated
    // neighbour picks it up and carries it along. That needs each move to be
    // applied to the result of the previous one.
    it('an edge dragged into a separated neighbour carries it along', () => {
      const { run, current } = setup();

      // c starts at 3; b ends at 2.
      run((h) => h.onDragStart(startEvent(1, 'end')));
      for (let px = 10; px <= 130; px += 10) {
        run((h) => h.onDragMove(moveEvent(1, 'end', px)));
      }

      expect(current()[1].end).toBeCloseTo(3.3, 5);
      expect(current()[2].start).toBe(current()[1].end);
    });

    it('a release keeps what the moves reported and reports nothing more', () => {
      const { run, storeChanges, current } = setup();

      run((h) => h.onDragStart(startEvent(0, 'end')));
      run((h) => h.onDragMove(moveEvent(0, 'end', 50)));
      run((h) => h.onDragEnd(endEvent(false)));

      expect(storeChanges).toHaveBeenCalledTimes(1);
      expect(current()[0].end).toBe(1.5);
    });
  });

  describe('with a preview source', () => {
    it('publishes moves to the preview and reports once, on release', () => {
      const { run, storeChanges, preview, current } = setup({ preview: true });
      const before = current();

      run((h) => h.onDragStart(startEvent(0, 'end')));
      run((h) => h.onDragMove(moveEvent(0, 'end', 30)));
      run((h) => h.onDragMove(moveEvent(0, 'end', 50)));

      expect(storeChanges).not.toHaveBeenCalled();
      expect(current()).toBe(before);
      expect(times(preview.source.getSnapshot()!)).toEqual([
        [0, 1.5],
        [1.5, 2],
        [3, 4],
      ]);

      run((h) => h.onDragEnd(endEvent(false)));

      expect(storeChanges).toHaveBeenCalledTimes(1);
      expect(times(current())).toEqual([
        [0, 1.5],
        [1.5, 2],
        [3, 4],
      ]);
      expect(preview.source.getSnapshot()).toBeNull();
    });

    it('an edge dragged into a separated neighbour carries it along', () => {
      const { run, preview } = setup({ preview: true });

      run((h) => h.onDragStart(startEvent(1, 'end')));
      for (let px = 10; px <= 130; px += 10) {
        run((h) => h.onDragMove(moveEvent(1, 'end', px)));
      }

      const previewed = preview.source.getSnapshot()!;
      expect(previewed[1].end).toBeCloseTo(3.3, 5);
      expect(previewed[2].start).toBe(previewed[1].end);
    });

    it('Escape drops the preview and reports nothing', () => {
      const { run, storeChanges, preview, current } = setup({ preview: true });
      const before = current();

      run((h) => h.onDragStart(startEvent(0, 'end')));
      run((h) => h.onDragMove(moveEvent(0, 'end', 50)));
      run((h) => h.onDragEnd(endEvent(true)));

      expect(storeChanges).not.toHaveBeenCalled();
      expect(current()).toBe(before);
      expect(preview.source.getSnapshot()).toBeNull();
    });

    it('a press and release without a move reports nothing', () => {
      const { run, storeChanges, preview } = setup({ preview: true });

      run((h) => h.onDragStart(startEvent(0, 'end')));
      run((h) => h.onDragEnd(endEvent(false)));

      expect(storeChanges).not.toHaveBeenCalled();
      expect(preview.source.getSnapshot()).toBeNull();
    });

    it('a drag whose component unmounts does not leave its preview behind', () => {
      const { run, preview, unmount } = setup({ preview: true });

      run((h) => h.onDragStart(startEvent(0, 'end')));
      run((h) => h.onDragMove(moveEvent(0, 'end', 50)));
      expect(preview.source.getSnapshot()).not.toBeNull();
      unmount();

      expect(preview.source.getSnapshot()).toBeNull();
    });

    it('keeps the same handlers for the whole drag', () => {
      const { run, preview } = setup({ preview: true });
      let first: unknown;
      let last: unknown;

      run((h) => {
        first = h.onDragMove;
        h.onDragStart(startEvent(0, 'end'));
      });
      run((h) => h.onDragMove(moveEvent(0, 'end', 50)));
      run((h) => {
        last = h.onDragMove;
      });

      expect(preview.source.getSnapshot()).not.toBeNull();
      expect(last).toBe(first);
    });
  });

  // #867: with a store, a drag writes only what it moved, by id, onto the
  // store's list as it is at the time of the write.
  describe('with a store', () => {
    function setupStore(options: { preview?: boolean; store?: AnnotationStoreOptions } = {}) {
      const preview = createValueSource<AnnotationData[] | null>(null);
      const store: AnnotationStore = createAnnotationStore(initial(), options.store);
      const view = renderHook(() =>
        useAnnotationDragHandlers({
          store,
          samplesPerPixel: SAMPLES_PER_PIXEL,
          sampleRate: SAMPLE_RATE,
          duration: 10,
          linkEndpoints: true,
          preview: options.preview ? preview : undefined,
        })
      );
      const run = (fn: (handlers: typeof view.result.current) => void) => {
        act(() => fn(view.result.current));
      };
      return { run, store, preview };
    }
    const extra = annotation('x', 8, 9);
    const ids = (list: readonly AnnotationData[]) => list.map((a) => a.id);

    it('a release keeps an annotation added during the drag', () => {
      const { run, store, preview } = setupStore({ preview: true });
      run((h) => h.onDragStart(startEvent(2, 'start')));
      run((h) => h.onDragMove(moveEvent(2, 'start', 20)));
      store.update((c) => [...c, extra]);
      run((h) => h.onDragEnd(endEvent(false)));

      expect(ids(store.getAnnotations())).toEqual(['a', 'b', 'c', 'x']);
      expect(store.getAnnotations()[2].start).toBeCloseTo(3.2, 5);
      expect(preview.source.getSnapshot()).toBeNull();
    });

    it('a carried neighbour is written by id and keeps a text change made during the drag', () => {
      const { run, store } = setupStore({ preview: true });
      run((h) => h.onDragStart(startEvent(0, 'end')));
      run((h) => h.onDragMove(moveEvent(0, 'end', 50)));
      store.update((c) => c.map((a) => (a.id === 'b' ? { ...a, lines: ['edited'] } : a)));
      run((h) => h.onDragEnd(endEvent(false)));

      const [a, b] = store.getAnnotations();
      expect(a.end).toBeCloseTo(1.5, 5);
      expect(b.start).toBeCloseTo(1.5, 5);
      expect(b.lines).toEqual(['edited']);
    });

    it('a release does nothing when the dragged annotation was removed', () => {
      const { run, store } = setupStore({ preview: true });
      run((h) => h.onDragStart(startEvent(0, 'end')));
      run((h) => h.onDragMove(moveEvent(0, 'end', 50)));
      store.update((c) => c.filter((a) => a.id !== 'a'));
      const before = store.getAnnotations();
      const listener = vi.fn();
      store.subscribe(listener);
      run((h) => h.onDragEnd(endEvent(false)));

      expect(store.getAnnotations()).toBe(before);
      expect(listener).not.toHaveBeenCalled();
    });

    it('Escape with a preview leaves the store as it was', () => {
      const { run, store, preview } = setupStore({ preview: true });
      const before = store.getAnnotations();
      run((h) => h.onDragStart(startEvent(0, 'end')));
      run((h) => h.onDragMove(moveEvent(0, 'end', 50)));
      run((h) => h.onDragEnd(endEvent(true)));

      expect(store.getAnnotations()).toBe(before);
      expect(preview.source.getSnapshot()).toBeNull();
    });

    it('without a preview, each move is written and Escape writes the start bounds back by id', () => {
      const { run, store } = setupStore();
      run((h) => h.onDragStart(startEvent(0, 'end')));
      run((h) => h.onDragMove(moveEvent(0, 'end', 50)));
      expect(store.getAnnotations()[0].end).toBeCloseTo(1.5, 5);
      store.update((c) => [...c, extra]);
      run((h) => h.onDragEnd(endEvent(true)));

      expect(times(store.getAnnotations())).toEqual([
        [0, 1],
        [1, 2],
        [3, 4],
        [8, 9],
      ]);
    });

    it('an edge dragged into a separated neighbour carries it along', () => {
      const { run, store } = setupStore({ preview: true });
      run((h) => h.onDragStart(startEvent(1, 'end')));
      for (let px = 10; px <= 130; px += 10) {
        run((h) => h.onDragMove(moveEvent(1, 'end', px)));
      }
      run((h) => h.onDragEnd(endEvent(false)));

      const list = store.getAnnotations();
      expect(list[1].end).toBeCloseTo(3.3, 5);
      expect(list[2].start).toBe(list[1].end);
    });

    it('a release that beforeChange refuses leaves the store and clears the preview', () => {
      const { run, store, preview } = setupStore({
        preview: true,
        store: { beforeChange: (_next, current) => current },
      });
      const before = store.getAnnotations();
      run((h) => h.onDragStart(startEvent(0, 'end')));
      run((h) => h.onDragMove(moveEvent(0, 'end', 50)));
      run((h) => h.onDragEnd(endEvent(false)));

      expect(store.getAnnotations()).toBe(before);
      expect(preview.source.getSnapshot()).toBeNull();
    });
  });
});
