import { describe, it, expect, vi, afterEach } from 'vitest';
import { createAnnotationStore } from '../annotations/store';
import type { AnnotationData } from '../types';

const note = (id: string, start = 0, end = 1): AnnotationData => ({
  id,
  start,
  end,
  lines: [id],
});

const ids = (list: readonly AnnotationData[]) => list.map((a) => a.id);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createAnnotationStore', () => {
  it('two updates in one tick both land', () => {
    const store = createAnnotationStore([note('z0')]);
    store.update((c) => [...c, note('a')]);
    store.update((c) => [...c, note('b')]);
    expect(ids(store.getAnnotations())).toEqual(['z0', 'a', 'b']);
  });

  it('starts empty without an initial list', () => {
    expect(createAnnotationStore().getAnnotations()).toEqual([]);
  });

  it('getAnnotations returns the same array until a change', () => {
    const store = createAnnotationStore([note('a')]);
    const first = store.getAnnotations();
    expect(store.getAnnotations()).toBe(first);
    store.set([note('b')]);
    expect(store.getAnnotations()).not.toBe(first);
  });

  it('an update returning current notifies nobody', () => {
    const store = createAnnotationStore([note('a')]);
    const before = store.getAnnotations();
    const listener = vi.fn();
    store.subscribe(listener);
    store.update((c) => c);
    expect(listener).not.toHaveBeenCalled();
    expect(store.getAnnotations()).toBe(before);
  });

  it('tells every subscriber after a change', () => {
    const store = createAnnotationStore();
    const a = vi.fn();
    const b = vi.fn();
    store.subscribe(a);
    store.subscribe(b);
    store.set([note('x')]);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops the listener', () => {
    const store = createAnnotationStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.set([note('x')]);
    expect(listener).not.toHaveBeenCalled();
  });

  describe('validation', () => {
    const invalid: Array<[string, AnnotationData[]]> = [
      ['a start that is a string', [{ ...note('a'), start: '1' as unknown as number }]],
      ['an end that is NaN', [{ ...note('a'), end: Number.NaN }]],
      ['two annotations with one id', [note('x'), note('x', 2, 3)]],
    ];

    it.each(invalid)('set refuses %s and keeps the value', (_label, list) => {
      const store = createAnnotationStore([note('keep')]);
      const before = store.getAnnotations();
      expect(() => store.set(list)).toThrow(TypeError);
      expect(store.getAnnotations()).toBe(before);
    });

    it.each(invalid)('update refuses %s and keeps the value', (_label, list) => {
      const store = createAnnotationStore([note('keep')]);
      const before = store.getAnnotations();
      expect(() => store.update(() => list)).toThrow(TypeError);
      expect(store.getAnnotations()).toBe(before);
    });

    it.each(invalid)('createAnnotationStore refuses %s', (_label, list) => {
      expect(() => createAnnotationStore(list)).toThrow(TypeError);
    });
  });

  describe('beforeChange', () => {
    it('stores next when it returns next', () => {
      const store = createAnnotationStore([], { beforeChange: (next) => next });
      store.set([note('a')]);
      expect(ids(store.getAnnotations())).toEqual(['a']);
    });

    it('stores nothing and tells nobody when it returns current', () => {
      const store = createAnnotationStore([note('a')], {
        beforeChange: (_next, current) => current,
      });
      const before = store.getAnnotations();
      const listener = vi.fn();
      store.subscribe(listener);
      store.update((c) => [...c, note('b')]);
      expect(store.getAnnotations()).toBe(before);
      expect(listener).not.toHaveBeenCalled();
    });

    it('stores the list it returns when it adjusts', () => {
      const store = createAnnotationStore([], {
        beforeChange: (next) => next.map((a) => ({ ...a, end: Math.min(a.end, 5) })),
      });
      store.set([note('a', 0, 9)]);
      expect(store.getAnnotations()[0].end).toBe(5);
    });

    it('gets the proposed list and the current one', () => {
      const beforeChange = vi.fn((next: readonly AnnotationData[]) => next);
      const store = createAnnotationStore([note('a')], { beforeChange });
      const current = store.getAnnotations();
      const proposed = [note('b')];
      store.set(proposed);
      expect(beforeChange).toHaveBeenCalledWith(proposed, current);
    });

    it('its result is validated', () => {
      const store = createAnnotationStore([note('a')], {
        beforeChange: () => [note('x'), note('x')],
      });
      const before = store.getAnnotations();
      expect(() => store.set([note('b')])).toThrow(TypeError);
      expect(store.getAnnotations()).toBe(before);
    });

    it('a throw from it reaches the caller and keeps the value', () => {
      const store = createAnnotationStore([note('a')], {
        beforeChange: () => {
          throw new Error('no');
        },
      });
      const before = store.getAnnotations();
      expect(() => store.set([note('b')])).toThrow('no');
      expect(store.getAnnotations()).toBe(before);
    });

    it('is not called for the initial list', () => {
      const beforeChange = vi.fn((next: readonly AnnotationData[]) => next);
      createAnnotationStore([note('a')], { beforeChange });
      expect(beforeChange).not.toHaveBeenCalled();
    });

    it('is not called for an invalid proposed list', () => {
      const beforeChange = vi.fn((next: readonly AnnotationData[]) => next);
      const store = createAnnotationStore([], { beforeChange });
      expect(() => store.set([note('x'), note('x')])).toThrow(TypeError);
      expect(beforeChange).not.toHaveBeenCalled();
    });
  });

  it('a throwing subscriber does not stop the others', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createAnnotationStore();
    const after = vi.fn();
    store.subscribe(() => {
      throw new Error('boom');
    });
    store.subscribe(after);
    store.set([note('a')]);
    expect(after).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
  });

  it('a subscriber that updates loses no change, and others read the final list', () => {
    const store = createAnnotationStore([note('a')]);
    store.subscribe(() => {
      store.update((c) => (c.some((x) => x.id === 'extra') ? c : [...c, note('extra', 5, 6)]));
    });
    let lastSeenByB: readonly AnnotationData[] | null = null;
    store.subscribe(() => {
      lastSeenByB = store.getAnnotations();
    });
    store.update((c) => [...c, note('b', 2, 3)]);
    expect(ids(store.getAnnotations())).toEqual(['a', 'b', 'extra']);
    expect(lastSeenByB).toBe(store.getAnnotations());
  });

  it('what it hands out is frozen in development', () => {
    const store = createAnnotationStore([note('b', 2, 3), note('a')]);
    const list = store.getAnnotations();
    expect(Object.isFrozen(list)).toBe(true);
    expect(Object.isFrozen(list[0])).toBe(true);
    expect(Object.isFrozen(list[0].lines)).toBe(true);
    expect(() => (list as AnnotationData[]).sort((x, y) => x.start - y.start)).toThrow(TypeError);
  });
});
