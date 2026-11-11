import { useEffect, useState } from 'react';
import type { MeterLevels, MeterSource, ValueSource } from '@waveform-playlist/core';

export interface UseThrottledValueOptions {
  /**
   * The most times per second the component may re-render with a new value.
   * `Infinity` passes every value through. Zero, a negative number or `NaN`
   * is treated as 1.
   * Default: 10
   */
  updateRate?: number;
}

const DEFAULT_UPDATE_RATE = 10;

/**
 * Read a `ValueSource` as React state, at a limited rate.
 *
 * Sources such as meter levels and recording progress change about 60 times a
 * second. This hook re-renders the calling component at most `updateRate`
 * times a second and always ends on the latest value. Prefer
 * `source.subscribe()` with a direct DOM write for anything drawn every frame;
 * use this for text readouts and other slow displays.
 */
export function useThrottledValue<T>(
  source: ValueSource<T>,
  options: UseThrottledValueOptions = {}
): T {
  const { updateRate = DEFAULT_UPDATE_RATE } = options;
  const [state, setState] = useState<{ source: ValueSource<T>; value: T }>(() => ({
    source,
    value: source.getSnapshot(),
  }));

  useEffect(() => {
    // 1000 / Infinity is 0: no throttling.
    const interval = 1000 / (updateRate > 0 ? updateRate : 1);
    // Far enough in the past that the first change is shown straight away.
    let lastUpdate = -Infinity;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      timer = null;
      lastUpdate = performance.now();
      const value = source.getSnapshot();
      setState((prev) =>
        prev.source === source && prev.value === value ? prev : { source, value }
      );
    };

    const unsubscribe = source.subscribe(() => {
      if (timer !== null) return;
      const wait = interval - (performance.now() - lastUpdate);
      if (wait <= 0) {
        flush();
      } else {
        timer = setTimeout(flush, wait);
      }
    });

    // The source may have changed between render and this effect.
    flush();
    lastUpdate = -Infinity;

    return () => {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
    };
  }, [source, updateRate]);

  // A new `source` prop is read directly on the render that receives it; the
  // effect above then replaces the state.
  return state.source === source ? state.value : source.getSnapshot();
}

/**
 * Meter levels as React state, at most `updateRate` times a second (default
 * 10). For a meter drawn every frame, pass the source to
 * `<SegmentedVUMeter meter={…} />` instead.
 */
export function useMeterLevels(
  meter: MeterSource,
  options: UseThrottledValueOptions = {}
): MeterLevels {
  return useThrottledValue(meter, options);
}
