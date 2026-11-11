import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { createValueSource, silentMeterLevels } from '@waveform-playlist/core';
import { useThrottledValue, useMeterLevels } from '../hooks/useThrottledValue';

describe('useThrottledValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('starts from the current value', () => {
    const { source } = createValueSource(3);
    const { result } = renderHook(() => useThrottledValue(source));
    expect(result.current).toBe(3);
  });

  it('renders at most updateRate times a second and ends on the latest value', () => {
    const { source, publish } = createValueSource(0);
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useThrottledValue(source, { updateRate: 10 });
    });
    const rendersAfterMount = renders;

    // One second of 60 Hz publishes.
    for (let i = 1; i <= 60; i++) {
      act(() => {
        publish(i);
        vi.advanceTimersByTime(1000 / 60);
      });
    }
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe(60);
    const updates = renders - rendersAfterMount;
    expect(updates).toBeGreaterThanOrEqual(9);
    expect(updates).toBeLessThanOrEqual(12);
  });

  it('shows a lone change straight away', () => {
    const { source, publish } = createValueSource(0);
    const { result } = renderHook(() => useThrottledValue(source, { updateRate: 2 }));

    act(() => {
      vi.advanceTimersByTime(5000);
      publish(1);
    });

    expect(result.current).toBe(1);
  });

  it('sets no state after unmount', () => {
    const { source, publish } = createValueSource(0);
    const { result, unmount } = renderHook(() => useThrottledValue(source, { updateRate: 10 }));
    act(() => {
      publish(1);
      publish(2);
    });
    unmount();
    publish(3);
    vi.advanceTimersByTime(1000);
    expect(result.current).toBe(1);
  });

  it('switches to a new source', () => {
    const first = createValueSource(1);
    const second = createValueSource(2);
    const { result, rerender } = renderHook(({ source }) => useThrottledValue(source), {
      initialProps: { source: first.source },
    });
    rerender({ source: second.source });
    expect(result.current).toBe(2);
  });

  it('useMeterLevels returns the meter levels', () => {
    const { source, publish } = createValueSource(silentMeterLevels(2));
    const { result } = renderHook(() => useMeterLevels(source));
    expect(result.current.levels).toEqual([0, 0]);
    const next = { levels: [0.5, 0.25], peakLevels: [0.5, 0.25], rmsLevels: [0.1, 0.1] };
    act(() => {
      vi.advanceTimersByTime(1000);
      publish(next);
    });
    expect(result.current).toBe(next);
  });
});
