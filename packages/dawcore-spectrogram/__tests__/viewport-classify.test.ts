import { describe, it, expect } from 'vitest';
import { classifyViewport } from '../src/orchestrator/viewport-classify';
import type { CanvasMeta } from '../src/orchestrator/viewport-classify';

const mk = (id: string, globalPixelOffset: number, widthPx: number): CanvasMeta => ({
  canvasId: id,
  globalPixelOffset,
  widthPx,
});

describe('classifyViewport', () => {
  it('returns empty tiers when no canvases', () => {
    const out = classifyViewport([], {
      visibleStartPx: 0,
      visibleEndPx: 100,
      bufferStartPx: 0,
      bufferEndPx: 100,
    });
    expect(out.viewport).toEqual([]);
    expect(out.buffer).toEqual([]);
    expect(out.remaining).toEqual([]);
  });

  it('classifies a canvas fully inside viewport as viewport-tier', () => {
    const c = mk('c1', 100, 200); // spans [100..300]
    const out = classifyViewport([c], {
      visibleStartPx: 50,
      visibleEndPx: 400,
      bufferStartPx: 0,
      bufferEndPx: 500,
    });
    expect(out.viewport).toEqual([c]);
    expect(out.buffer).toEqual([]);
    expect(out.remaining).toEqual([]);
  });

  it('classifies a canvas intersecting only the buffer as buffer-tier', () => {
    const c = mk('c1', 500, 100); // spans [500..600]
    const out = classifyViewport([c], {
      visibleStartPx: 0,
      visibleEndPx: 400,
      bufferStartPx: 0,
      bufferEndPx: 700,
    });
    expect(out.viewport).toEqual([]);
    expect(out.buffer).toEqual([c]);
    expect(out.remaining).toEqual([]);
  });

  it('classifies a canvas outside the buffer band as remaining', () => {
    const c = mk('c1', 1000, 100); // spans [1000..1100]
    const out = classifyViewport([c], {
      visibleStartPx: 0,
      visibleEndPx: 400,
      bufferStartPx: 0,
      bufferEndPx: 700,
    });
    expect(out.viewport).toEqual([]);
    expect(out.buffer).toEqual([]);
    expect(out.remaining).toEqual([c]);
  });

  it('viewport intersection wins over buffer when canvas straddles both', () => {
    const c = mk('c1', 350, 100); // spans [350..450], visible is [0..400], buffer is [0..700]
    const out = classifyViewport([c], {
      visibleStartPx: 0,
      visibleEndPx: 400,
      bufferStartPx: 0,
      bufferEndPx: 700,
    });
    expect(out.viewport).toEqual([c]);
    expect(out.buffer).toEqual([]);
    expect(out.remaining).toEqual([]);
  });

  it('partitions a mixed canvas list across all three tiers', () => {
    const a = mk('a', 100, 100); // viewport
    const b = mk('b', 500, 100); // buffer
    const c = mk('c', 1500, 100); // remaining
    const out = classifyViewport([a, b, c], {
      visibleStartPx: 0,
      visibleEndPx: 400,
      bufferStartPx: 0,
      bufferEndPx: 700,
    });
    expect(out.viewport).toEqual([a]);
    expect(out.buffer).toEqual([b]);
    expect(out.remaining).toEqual([c]);
  });
});
