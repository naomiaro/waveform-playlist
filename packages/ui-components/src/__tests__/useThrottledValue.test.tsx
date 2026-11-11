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

  it('unsubscribes and drops its pending timer on unmount', () => {
    const handle = createValueSource(0);
    let subscriptions = 0;
    const source = {
      getSnapshot: handle.source.getSnapshot,
      subscribe(listener: (value: number) => void) {
        subscriptions++;
        const remove = handle.source.subscribe(listener);
        return () => {
          subscriptions--;
          remove();
        };
      },
    };
    const { unmount } = renderHook(() => useThrottledValue(source, { updateRate: 10 }));
    act(() => {
      handle.publish(1);
      handle.publish(2); // inside the interval: schedules the trailing update
    });
    expect(subscriptions).toBe(1);
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(subscriptions).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('an infinite updateRate passes every value through', () => {
    const { source, publish } = createValueSource(0);
    const { result } = renderHook(() => useThrottledValue(source, { updateRate: Infinity }));
    for (let i = 1; i <= 5; i++) {
      act(() => {
        publish(i);
      });
      expect(result.current).toBe(i);
    }
  });

  it('follows a changed updateRate', () => {
    const { source, publish } = createValueSource(0);
    const { result, rerender } = renderHook(
      ({ updateRate }) => useThrottledValue(source, { updateRate }),
      { initialProps: { updateRate: 1 } }
    );
    act(() => {
      publish(1);
      publish(2);
    });
    expect(result.current).toBe(1);

    rerender({ updateRate: Infinity });
    expect(result.current).toBe(2);
    act(() => {
      publish(3);
    });
    expect(result.current).toBe(3);
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
