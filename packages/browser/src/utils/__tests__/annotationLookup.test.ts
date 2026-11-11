import { describe, it, expect } from 'vitest';
import { createAnnotationLookup } from '../annotationLookup';

interface Ann {
  id: string;
  start: number;
  end: number;
}

const findAtTime = (list: Ann[], time: number) => list.find((a) => time >= a.start && time < a.end);

// Deterministic PRNG so a failure is reproducible.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wraps a list so every index read is counted. */
function counted(list: Ann[]) {
  const counter = { reads: 0 };
  const proxy = new Proxy(list, {
    get(target, key, receiver) {
      if (typeof key === 'string' && /^\d+$/.test(key)) counter.reads++;
      return Reflect.get(target, key, receiver);
    },
  });
  return { proxy, counter };
}

const ordered = (count: number): Ann[] =>
  Array.from({ length: count }, (_, i) => ({ id: 'a' + i, start: i * 2, end: i * 2 + 1.5 }));

describe('annotation lookup: atTime', () => {
  it('matches Array.find on an ordered list, including gaps and both ends', () => {
    const list = ordered(50);
    const lookup = createAnnotationLookup<Ann>();
    for (let time = -1; time < 102; time += 0.25) {
      expect(lookup.atTime(list, time)).toBe(findAtTime(list, time));
    }
    // and when seeking backwards / at random
    const random = mulberry32(1);
    for (let i = 0; i < 500; i++) {
      const time = random() * 110 - 5;
      expect(lookup.atTime(list, time)).toBe(findAtTime(list, time));
    }
  });

  it('treats start as inclusive and end as exclusive, and touching ranges as ordered', () => {
    const list: Ann[] = [
      { id: 'a', start: 0, end: 1 },
      { id: 'b', start: 1, end: 2 },
    ];
    const lookup = createAnnotationLookup<Ann>();
    expect(lookup.atTime(list, 0)?.id).toBe('a');
    expect(lookup.atTime(list, 1)?.id).toBe('b');
    expect(lookup.atTime(list, 2)).toBeUndefined();
  });

  it('matches Array.find on overlapping, unsorted and malformed lists', () => {
    const random = mulberry32(2);
    for (let round = 0; round < 200; round++) {
      const list: Ann[] = Array.from({ length: 1 + Math.floor(random() * 8) }, (_, i) => {
        const start = random() * 10;
        const kind = random();
        const end = kind < 0.1 ? NaN : kind < 0.2 ? start - 1 : start + random() * 5;
        return { id: 'a' + i, start, end };
      });
      const lookup = createAnnotationLookup<Ann>();
      for (let step = 0; step < 60; step++) {
        const time = step * 0.25;
        expect(lookup.atTime(list, time)).toBe(findAtTime(list, time));
      }
    }
  });

  it('prefers the first of two overlapping annotations, as find does', () => {
    // b is found first at t=3; at t=6 the earlier-indexed a also contains the time.
    const list: Ann[] = [
      { id: 'a', start: 5, end: 10 },
      { id: 'b', start: 0, end: 8 },
    ];
    const lookup = createAnnotationLookup<Ann>();
    expect(lookup.atTime(list, 3)?.id).toBe('b');
    expect(lookup.atTime(list, 6)?.id).toBe('a');
  });

  it('follows a replaced list', () => {
    const lookup = createAnnotationLookup<Ann>();
    const first = ordered(4);
    expect(lookup.atTime(first, 2.5)?.id).toBe('a1');
    const second = first.map((a) => (a.id === 'a1' ? { ...a, end: 2.2 } : a));
    expect(lookup.atTime(second, 2.5)).toBeUndefined();
    expect(lookup.atTime([], 2.5)).toBeUndefined();
  });

  it('does not scan an ordered list on every frame', () => {
    const { proxy, counter } = counted(ordered(5000));
    const lookup = createAnnotationLookup<Ann>();
    lookup.atTime(proxy, 9000); // first call validates the ordering once
    counter.reads = 0;

    // 600 frames inside one annotation, then inside the gap after it
    for (let frame = 0; frame < 600; frame++) lookup.atTime(proxy, 9000 + frame * 0.002);
    expect(counter.reads).toBeLessThanOrEqual(600 * 2);

    counter.reads = 0;
    for (let frame = 0; frame < 100; frame++) lookup.atTime(proxy, 9001.6 + frame * 0.002);
    // a miss costs a binary search (~13 steps of 5000), not 5000 reads
    expect(counter.reads).toBeLessThan(100 * 20);
  });
});

describe('annotation lookup: byId', () => {
  it('matches Array.find, including duplicates and misses', () => {
    const list: Ann[] = [
      { id: 'a', start: 0, end: 1 },
      { id: 'b', start: 1, end: 2 },
      { id: 'a', start: 2, end: 3 },
    ];
    const lookup = createAnnotationLookup<Ann>();
    expect(lookup.byId(list, 'a')).toBe(list[0]);
    expect(lookup.byId(list, 'a')).toBe(list[0]);
    expect(lookup.byId(list, 'b')).toBe(list[1]);
    expect(lookup.byId(list, 'missing')).toBeUndefined();
    expect(lookup.byId(list, 'b')).toBe(list[1]);
  });

  it('follows a replaced list', () => {
    const lookup = createAnnotationLookup<Ann>();
    const first = ordered(3);
    expect(lookup.byId(first, 'a1')).toBe(first[1]);
    const second = first.map((a) => ({ ...a }));
    expect(lookup.byId(second, 'a1')).toBe(second[1]);
    expect(lookup.byId([], 'a1')).toBeUndefined();
  });

  it('does not scan for the same id on every frame', () => {
    const { proxy, counter } = counted(ordered(5000));
    const lookup = createAnnotationLookup<Ann>();
    lookup.byId(proxy, 'a4500');
    counter.reads = 0;
    for (let frame = 0; frame < 600; frame++) lookup.byId(proxy, 'a4500');
    expect(counter.reads).toBe(0);
  });
});
