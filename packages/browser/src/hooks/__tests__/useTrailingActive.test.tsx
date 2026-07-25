// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useTrailingActive } from '../useTrailingActive';

describe('useTrailingActive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(async () => {
    // React 19 teardown flake guard: cleanup inside act
    await act(async () => {
      cleanup();
    });
    vi.useRealTimers();
  });

  it('is false initially when inactive', () => {
    const { result } = renderHook(() => useTrailingActive(false, 200));
    expect(result.current).toBe(false);
  });

  it('is true immediately when active', () => {
    const { result } = renderHook(({ a }) => useTrailingActive(a, 200), {
      initialProps: { a: true },
    });
    expect(result.current).toBe(true);
  });

  it('stays true for trailingMs after deactivation, then goes false', () => {
    const { result, rerender } = renderHook(({ a }) => useTrailingActive(a, 200), {
      initialProps: { a: true },
    });
    rerender({ a: false });
    expect(result.current).toBe(true); // trailing window
    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(false);
  });

  it('re-activation during the trailing window cancels the pending deactivation', () => {
    const { result, rerender } = renderHook(({ a }) => useTrailingActive(a, 200), {
      initialProps: { a: true },
    });
    rerender({ a: false });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ a: true });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(true);
  });
});
