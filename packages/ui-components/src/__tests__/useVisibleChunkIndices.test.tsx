import React, { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useVisibleChunkIndices, ScrollViewportProvider } from '../contexts/ScrollViewport';

// Mock a scroll container element with configurable scrollLeft and clientWidth
function createMockContainer(scrollLeft: number, clientWidth: number): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'scrollLeft', { value: scrollLeft, writable: true });
  Object.defineProperty(el, 'clientWidth', { value: clientWidth, writable: true });
  return el;
}

// Wrapper that provides a ScrollViewportProvider with a mock container
function createWrapper(scrollLeft: number, clientWidth: number) {
  const container = createMockContainer(scrollLeft, clientWidth);
  const containerRef = { current: container };

  // Mock ResizeObserver since jsdom doesn't support it
  const originalRO = globalThis.ResizeObserver;
  globalThis.ResizeObserver = vi.fn().mockImplementation(function () {
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    };
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <ScrollViewportProvider containerRef={containerRef}>{children}</ScrollViewportProvider>
  );

  return { wrapper, cleanup: () => (globalThis.ResizeObserver = originalRO) };
}

describe('useVisibleChunkIndices', () => {
  let rafCallbacks: FrameRequestCallback[];
  let originalRAF: typeof requestAnimationFrame;
  let originalCAF: typeof cancelAnimationFrame;

  beforeEach(() => {
    rafCallbacks = [];
    originalRAF = globalThis.requestAnimationFrame;
    originalCAF = globalThis.cancelAnimationFrame;
    // Synchronous RAF: collect callbacks and flush immediately
    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    globalThis.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRAF;
    globalThis.cancelAnimationFrame = originalCAF;
  });

  it('returns all chunks when no ScrollViewportProvider is present', () => {
    // totalWidth=3000, chunkWidth=1000 → 3 chunks
    const { result } = renderHook(() => useVisibleChunkIndices(3000, 1000));
    expect(result.current).toEqual([0, 1, 2]);
  });

  it('returns all chunks when no ScrollViewportProvider with originX', () => {
    const { result } = renderHook(() => useVisibleChunkIndices(3000, 1000, 5000));
    expect(result.current).toEqual([0, 1, 2]);
  });

  it('returns visible chunks for clip at origin 0', () => {
    // Container at scroll=0, width=1000 → visibleStart=0, visibleEnd=1000+1500=2500
    const { wrapper, cleanup } = createWrapper(0, 1000);
    try {
      const { result } = renderHook(() => useVisibleChunkIndices(5000, 1000, 0), { wrapper });

      // Flush RAF to trigger initial measurement
      for (const cb of rafCallbacks) cb(0);

      // With viewport [0, 2500], chunks 0,1,2 should be visible (0-1000, 1000-2000, 2000-3000)
      expect(result.current).toEqual([0, 1, 2]);
    } finally {
      cleanup();
    }
  });

  it('returns visible chunks for clip at non-zero origin (the bug scenario)', () => {
    // Container scrolled to 5000, width=1000
    // visibleStart = max(0, 5000-1500) = 3500
    // visibleEnd = 5000 + 1000 + 1500 = 7500
    const { wrapper, cleanup } = createWrapper(5000, 1000);
    try {
      // Clip starts at pixel 5000, has 3000px of content (3 chunks)
      const { result } = renderHook(() => useVisibleChunkIndices(3000, 1000, 5000), { wrapper });

      for (const cb of rafCallbacks) cb(0);

      // Chunk 0: local [0, 1000) → global [5000, 6000) — inside [3500, 7500] ✓
      // Chunk 1: local [1000, 2000) → global [6000, 7000) — inside [3500, 7500] ✓
      // Chunk 2: local [2000, 3000) → global [7000, 8000) — 7000 < 7500, so visible ✓
      expect(result.current).toEqual([0, 1, 2]);
    } finally {
      cleanup();
    }
  });

  it('culls chunks when clip is entirely outside viewport', () => {
    // Viewport centered at scroll=0, width=1000 → visibleStart=0, visibleEnd=2500
    const { wrapper, cleanup } = createWrapper(0, 1000);
    try {
      // Clip at origin 10000 — way past the viewport
      const { result } = renderHook(() => useVisibleChunkIndices(2000, 1000, 10000), { wrapper });

      for (const cb of rafCallbacks) cb(0);

      // Global positions: [10000, 11000) and [11000, 12000) — both outside [0, 2500]
      expect(result.current).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it('shows partially visible clip (only some chunks in viewport)', () => {
    // Viewport: scroll=4000, width=1000 → visibleStart=2500, visibleEnd=6500
    const { wrapper, cleanup } = createWrapper(4000, 1000);
    try {
      // Clip at origin 3000, 5000px wide (5 chunks)
      const { result } = renderHook(() => useVisibleChunkIndices(5000, 1000, 3000), { wrapper });

      for (const cb of rafCallbacks) cb(0);

      // Chunk 0: global [3000, 4000) — inside [2500, 6500] ✓
      // Chunk 1: global [4000, 5000) — inside ✓
      // Chunk 2: global [5000, 6000) — inside ✓
      // Chunk 3: global [6000, 7000) — 6000 < 6500, so visible ✓
      // Chunk 4: global [7000, 8000) — 7000 >= 6500, culled ✗
      expect(result.current).toEqual([0, 1, 2, 3]);
    } finally {
      cleanup();
    }
  });

  it('handles originX=0 identically to omitting originX', () => {
    const { wrapper, cleanup } = createWrapper(0, 1000);
    try {
      const { result: withOrigin } = renderHook(() => useVisibleChunkIndices(5000, 1000, 0), {
        wrapper,
      });
      const { result: withoutOrigin } = renderHook(() => useVisibleChunkIndices(5000, 1000), {
        wrapper,
      });

      for (const cb of rafCallbacks) cb(0);

      expect(withOrigin.current).toEqual(withoutOrigin.current);
    } finally {
      cleanup();
    }
  });
});
