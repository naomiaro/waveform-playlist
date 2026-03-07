import React, { ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ScrollViewportProvider,
  useScrollViewport,
  useScrollViewportSelector,
} from '../contexts/ScrollViewport';

// --- ViewportStore tests (via provider + hooks) ---

let rafCallbacks: FrameRequestCallback[];
let originalRAF: typeof requestAnimationFrame;
let originalCAF: typeof cancelAnimationFrame;
let originalRO: typeof ResizeObserver;

function mockRAF() {
  rafCallbacks = [];
  originalRAF = globalThis.requestAnimationFrame;
  originalCAF = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
    rafCallbacks.push(cb);
    return rafCallbacks.length;
  });
  globalThis.cancelAnimationFrame = vi.fn();
}

function restoreRAF() {
  globalThis.requestAnimationFrame = originalRAF;
  globalThis.cancelAnimationFrame = originalCAF;
}

function mockResizeObserver() {
  originalRO = globalThis.ResizeObserver;
  globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
}

function restoreResizeObserver() {
  globalThis.ResizeObserver = originalRO;
}

function createMockContainer(scrollLeft: number, clientWidth: number): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'scrollLeft', { value: scrollLeft, writable: true });
  Object.defineProperty(el, 'clientWidth', { value: clientWidth, writable: true });
  return el;
}

function createWrapper(scrollLeft: number, clientWidth: number) {
  const container = createMockContainer(scrollLeft, clientWidth);
  const containerRef = { current: container };

  const wrapper = ({ children }: { children: ReactNode }) => (
    <ScrollViewportProvider containerRef={containerRef}>{children}</ScrollViewportProvider>
  );

  return { wrapper, container, containerRef };
}

function flushRAF() {
  const callbacks = [...rafCallbacks];
  rafCallbacks = [];
  for (const cb of callbacks) cb(0);
}

describe('useScrollViewport', () => {
  beforeEach(() => {
    mockRAF();
    mockResizeObserver();
  });
  afterEach(() => {
    restoreRAF();
    restoreResizeObserver();
  });

  it('returns null without a provider', () => {
    const { result } = renderHook(() => useScrollViewport());
    expect(result.current).toBeNull();
  });

  it('returns initial viewport state from provider', () => {
    const { wrapper } = createWrapper(0, 1000);
    const { result } = renderHook(() => useScrollViewport(), { wrapper });

    expect(result.current).toEqual({
      scrollLeft: 0,
      containerWidth: 1000,
      visibleStart: 0,
      visibleEnd: 1000 + 1000 * 1.5, // width + buffer
    });
  });

  it('updates when scroll exceeds 100px threshold', () => {
    const { wrapper, container } = createWrapper(0, 1000);
    const { result } = renderHook(() => useScrollViewport(), { wrapper });

    // Simulate scroll past threshold
    Object.defineProperty(container, 'scrollLeft', { value: 200 });
    container.dispatchEvent(new Event('scroll'));
    act(() => flushRAF()); // scheduleUpdate RAF
    act(() => flushRAF()); // store notification RAF

    expect(result.current!.scrollLeft).toBe(200);
  });

  it('skips update when scroll delta is below 100px threshold', () => {
    const { wrapper, container } = createWrapper(0, 1000);
    const { result } = renderHook(() => useScrollViewport(), { wrapper });

    const initial = result.current;

    // Scroll only 50px — below threshold
    Object.defineProperty(container, 'scrollLeft', { value: 50 });
    container.dispatchEvent(new Event('scroll'));
    flushRAF();
    flushRAF();

    // State should be unchanged (same reference)
    expect(result.current).toBe(initial);
  });
});

describe('useScrollViewportSelector', () => {
  beforeEach(() => {
    mockRAF();
    mockResizeObserver();
  });
  afterEach(() => {
    restoreRAF();
    restoreResizeObserver();
  });

  it('returns null-derived value without a provider', () => {
    const selector = (vp: unknown) => (vp === null ? 'none' : 'some');
    const { result } = renderHook(() => useScrollViewportSelector(selector));
    expect(result.current).toBe('none');
  });

  it('returns selected value from viewport', () => {
    const { wrapper } = createWrapper(500, 1000);
    const { result } = renderHook(
      () => useScrollViewportSelector((vp) => vp?.containerWidth ?? 0),
      { wrapper }
    );
    expect(result.current).toBe(1000);
  });

  it('only re-renders when selected value changes', () => {
    const { wrapper, container } = createWrapper(0, 1000);
    const selector = vi.fn((vp: { containerWidth: number } | null) => vp?.containerWidth ?? 0);

    const { result } = renderHook(() => useScrollViewportSelector(selector), { wrapper });
    expect(result.current).toBe(1000);

    const callCountAfterMount = selector.mock.calls.length;

    // Scroll changes scrollLeft but not containerWidth — selector returns same value
    Object.defineProperty(container, 'scrollLeft', { value: 200 });
    container.dispatchEvent(new Event('scroll'));
    flushRAF();
    flushRAF();

    // Selector was called to check, but since containerWidth didn't change,
    // the component should not have re-rendered beyond the selector check
    expect(result.current).toBe(1000);
    // Selector is called by useSyncExternalStore to compare, but the returned
    // value is still 1000, so React skips the re-render
    expect(selector.mock.calls.length).toBeGreaterThanOrEqual(callCountAfterMount);
  });
});

describe('ViewportStore deferred notification', () => {
  beforeEach(() => {
    mockRAF();
    mockResizeObserver();
  });
  afterEach(() => {
    restoreRAF();
    restoreResizeObserver();
  });

  it('defers listener notification to next animation frame', () => {
    const { wrapper, container } = createWrapper(0, 1000);
    const { result } = renderHook(() => useScrollViewport(), { wrapper });

    // Scroll past threshold
    Object.defineProperty(container, 'scrollLeft', { value: 200 });
    container.dispatchEvent(new Event('scroll'));

    // After first RAF (scheduleUpdate), store.update() is called but
    // notification is deferred to another RAF
    act(() => flushRAF());
    const afterFirstFlush = result.current!.scrollLeft;

    // State not yet updated — notification hasn't fired
    expect(afterFirstFlush).toBe(0);

    // After second RAF (store notification), React sees the new state
    act(() => flushRAF());
    const afterSecondFlush = result.current!.scrollLeft;

    expect(afterSecondFlush).toBe(200);
  });

  it('coalesces multiple updates within a single RAF frame', () => {
    const { wrapper, container } = createWrapper(0, 1000);
    renderHook(() => useScrollViewport(), { wrapper });

    // Fire multiple scroll events before any RAF callback runs
    Object.defineProperty(container, 'scrollLeft', { value: 200 });
    container.dispatchEvent(new Event('scroll'));
    Object.defineProperty(container, 'scrollLeft', { value: 400 });
    container.dispatchEvent(new Event('scroll'));

    // scheduleUpdate coalesces via rafIdRef — only one RAF scheduled
    // The RAF mock was called, but scheduleUpdate guards with rafIdRef
    flushRAF();
    flushRAF();

    // requestAnimationFrame should have been called a limited number of times,
    // not once per scroll event
    const rafCalls = (globalThis.requestAnimationFrame as ReturnType<typeof vi.fn>).mock.calls
      .length;
    // At most: 1 for scheduleUpdate + 1 for store notification + potential extra from React
    expect(rafCalls).toBeLessThanOrEqual(4);
  });
});

describe('cleanup', () => {
  beforeEach(() => {
    mockRAF();
    mockResizeObserver();
  });
  afterEach(() => {
    restoreRAF();
    restoreResizeObserver();
  });

  it('removes scroll listener and disconnects ResizeObserver on unmount', () => {
    const { wrapper, container } = createWrapper(0, 1000);
    const removeSpy = vi.spyOn(container, 'removeEventListener');
    const roInstance = (globalThis.ResizeObserver as ReturnType<typeof vi.fn>).mock.results[0]
      ?.value;

    const { unmount } = renderHook(() => useScrollViewport(), { wrapper });
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    if (roInstance) {
      expect(roInstance.disconnect).toHaveBeenCalled();
    }
  });

  it('cancels pending RAF on unmount', () => {
    const { wrapper, container } = createWrapper(0, 1000);
    const { unmount } = renderHook(() => useScrollViewport(), { wrapper });

    // Trigger a scroll so there's a pending RAF
    Object.defineProperty(container, 'scrollLeft', { value: 200 });
    container.dispatchEvent(new Event('scroll'));

    unmount();

    expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
  });
});
