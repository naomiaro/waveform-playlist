import { describe, it, expect, afterEach, vi } from 'vitest';
import React, { Profiler } from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { createValueSource, silentMeterLevels, type MeterLevels } from '@waveform-playlist/core';
import { defaultTheme } from '../wfpl-theme';
import { SegmentedVUMeter } from '../components/SegmentedVUMeter';

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={defaultTheme}>{ui}</ThemeProvider>);

function isActive(segment: Element): boolean {
  const style = (segment as HTMLElement).style;
  const inactiveGrey =
    style.backgroundColor.includes('128') && style.backgroundColor.includes('0.2');
  return !inactiveGrey && style.opacity !== '0.15' && !segment.hasAttribute('data-peak');
}

function activeCounts(container: HTMLElement): number[] {
  return Array.from(container.querySelectorAll('[data-channel]')).map(
    (channel) => Array.from(channel.querySelectorAll('[data-segment]')).filter(isActive).length
  );
}

function levelsOf(levels: number[], peakLevels: number[] = levels): MeterLevels {
  return { levels, peakLevels, rmsLevels: levels };
}

describe('SegmentedVUMeter with a meter source', () => {
  afterEach(() => {
    cleanup();
  });

  it('draws the source value at mount', () => {
    const { source } = createValueSource(levelsOf([1.0, 0]));
    const { container } = renderWithTheme(
      <SegmentedVUMeter meter={source} segmentCount={12} showScale={false} />
    );
    // Same expectations as the `levels` prop: 0 dB lights 11 of 12, silence none.
    // The peak marker replaces one lit segment of the first channel.
    expect(container.querySelectorAll('[data-channel]').length).toBe(2);
    expect(activeCounts(container)).toEqual([10, 0]);
  });

  it('follows published levels without rendering', () => {
    const { source, publish } = createValueSource(silentMeterLevels(1));
    const onRender = vi.fn();
    const { container } = renderWithTheme(
      <Profiler id="meter" onRender={onRender}>
        <SegmentedVUMeter meter={source} segmentCount={12} showScale={false} />
      </Profiler>
    );
    expect(activeCounts(container)).toEqual([0]);
    const rendersAfterMount = onRender.mock.calls.length;

    // The held peak of 0 puts the white marker on the bottom segment, which
    // `isActive` does not count: 0 dB lights 11 of 12, 10 besides the marker.
    act(() => {
      publish(levelsOf([1.0], [0]));
    });
    expect(activeCounts(container)).toEqual([10]);

    act(() => {
      publish(levelsOf([0.8], [0]));
    });
    const half = activeCounts(container)[0];
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(10);

    act(() => {
      publish(levelsOf([0], [0]));
    });
    expect(activeCounts(container)).toEqual([0]);
    expect(onRender.mock.calls.length).toBe(rendersAfterMount);
  });

  it('matches what the levels prop draws for the same values', () => {
    const values = levelsOf([0.8, 0.35], [0.9, 0.6]);
    const { source } = createValueSource(values);
    const fromSource = renderWithTheme(
      <SegmentedVUMeter meter={source} segmentCount={16} coloredInactive />
    );
    const fromProps = renderWithTheme(
      <SegmentedVUMeter
        levels={values.levels}
        peakLevels={values.peakLevels}
        segmentCount={16}
        coloredInactive
      />
    );
    const describe = (container: HTMLElement) =>
      Array.from(container.querySelectorAll('[data-segment]')).map((segment) => {
        const style = (segment as HTMLElement).style;
        return [
          style.backgroundColor,
          style.opacity,
          style.boxShadow,
          segment.hasAttribute('data-peak'),
        ].join('|');
      });
    expect(describe(fromSource.container)).toEqual(describe(fromProps.container));
  });

  it('moves the peak marker as the held peak changes', () => {
    const { source, publish } = createValueSource(levelsOf([0], [1.0]));
    const { container } = renderWithTheme(
      <SegmentedVUMeter meter={source} segmentCount={12} showScale={false} />
    );
    const peakIndex = () =>
      Array.from(container.querySelectorAll('[data-segment]')).findIndex((segment) =>
        segment.hasAttribute('data-peak')
      );
    const first = peakIndex();
    expect(container.querySelectorAll('[data-peak]').length).toBe(1);

    act(() => {
      publish(levelsOf([0], [0.4]));
    });

    expect(container.querySelectorAll('[data-peak]').length).toBe(1);
    expect(peakIndex()).toBeGreaterThan(first);
  });

  it('renders again only when the channel count changes', () => {
    const { source, publish } = createValueSource(silentMeterLevels(1));
    const onRender = vi.fn();
    const { container } = renderWithTheme(
      <Profiler id="meter" onRender={onRender}>
        <SegmentedVUMeter meter={source} segmentCount={12} showScale={false} />
      </Profiler>
    );
    expect(container.querySelectorAll('[data-channel]').length).toBe(1);
    const rendersAfterMount = onRender.mock.calls.length;

    act(() => {
      publish(levelsOf([1.0, 0]));
    });

    expect(container.querySelectorAll('[data-channel]').length).toBe(2);
    expect(onRender.mock.calls.length).toBeGreaterThan(rendersAfterMount);
    expect(activeCounts(container)).toEqual([10, 0]);
  });

  it('keeps the drawn levels when a prop changes', () => {
    const { source, publish } = createValueSource(silentMeterLevels(1));
    const { container, rerender } = renderWithTheme(
      <SegmentedVUMeter meter={source} segmentCount={12} showScale={false} />
    );
    act(() => {
      publish(levelsOf([1.0], [0]));
    });
    expect(activeCounts(container)).toEqual([10]);

    rerender(
      <ThemeProvider theme={defaultTheme}>
        <SegmentedVUMeter meter={source} segmentCount={12} showScale={false} labelColor="#fff" />
      </ThemeProvider>
    );
    expect(activeCounts(container)).toEqual([10]);

    act(() => {
      publish(levelsOf([0], [0]));
    });
    expect(activeCounts(container)).toEqual([0]);
  });

  it('stops listening when it unmounts', () => {
    const handle = createValueSource(silentMeterLevels(1));
    const unsubscribe = vi.fn();
    const subscribe = vi.fn((listener: (value: MeterLevels) => void) => {
      const remove = handle.source.subscribe(listener);
      return () => {
        unsubscribe();
        remove();
      };
    });
    const source = { subscribe, getSnapshot: handle.source.getSnapshot };
    const { unmount } = renderWithTheme(<SegmentedVUMeter meter={source} />);
    const subscriptions = subscribe.mock.calls.length;
    expect(subscriptions).toBeGreaterThan(0);

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(subscriptions);
  });
});
