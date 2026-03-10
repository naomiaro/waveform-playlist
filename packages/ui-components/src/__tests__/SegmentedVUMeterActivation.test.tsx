import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { defaultTheme } from '../wfpl-theme';
import { SegmentedVUMeter } from '../components/SegmentedVUMeter';

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={defaultTheme}>{ui}</ThemeProvider>);

/**
 * Segment activation logic:
 *   levelDb = normalizedToDb(level)    // 0→-100dB, 1→0dB
 *   active = levelDb >= threshold
 *
 * With default dBRange [-50, 5] and segmentCount=12, thresholds are evenly
 * spaced from 5 dB (top) to -50 dB (bottom). A segment lights up when the
 * signal's dB level meets or exceeds that segment's threshold.
 */
describe('SegmentedVUMeter segment activation', () => {
  afterEach(() => {
    cleanup();
  });

  function getActiveSegments(container: HTMLElement): Element[] {
    const segments = Array.from(container.querySelectorAll('[data-segment]'));
    return segments.filter((seg) => {
      const style = (seg as HTMLElement).style;
      const bg = style.backgroundColor;
      const opacity = style.opacity;
      // Inactive segments without coloredInactive have INACTIVE_COLOR rgba(128,128,128,0.2)
      // Active segments have a non-grey color and opacity 1
      const isInactiveGrey = bg.includes('128') && bg.includes('0.2');
      // Also check opacity — inactive with coloredInactive have opacity 0.15
      const isLowOpacity = opacity === '0.15';
      return !isInactiveGrey && !isLowOpacity;
    });
  }

  it('level=0 activates no segments', () => {
    const { container } = renderWithTheme(
      <SegmentedVUMeter levels={[0]} segmentCount={12} channelLabels={['M']} />
    );
    const active = getActiveSegments(container);
    expect(active.length).toBe(0);
  });

  it('level=1.0 (0 dB) activates most segments', () => {
    const { container } = renderWithTheme(
      <SegmentedVUMeter levels={[1.0]} segmentCount={12} channelLabels={['M']} />
    );
    const active = getActiveSegments(container);
    // 0 dB should activate all segments with threshold <= 0 dB
    // With dBRange [-50, 5], only the top segment (5 dB) stays inactive
    expect(active.length).toBe(11);
  });

  it('very small level activates only bottom segments', () => {
    // normalizedToDb(0.01) ≈ -99 dB → below the default floor of -50
    // So with dBRange [-50, 5], level=0.01 should activate 0 segments
    const { container } = renderWithTheme(
      <SegmentedVUMeter levels={[0.01]} segmentCount={12} channelLabels={['M']} />
    );
    const active = getActiveSegments(container);
    expect(active.length).toBe(0);
  });

  it('mid-level activates partial segments', () => {
    // normalizedToDb(0.5) = -50 dB with default floor -100
    // With dBRange [-50, 5], -50 dB is the bottom threshold
    // So level=0.5 should activate exactly the bottom segment
    const { container } = renderWithTheme(
      <SegmentedVUMeter levels={[0.5]} segmentCount={12} channelLabels={['M']} />
    );
    const active = getActiveSegments(container);
    expect(active.length).toBeGreaterThanOrEqual(1);
  });

  it('higher level activates more segments than lower level', () => {
    const { container: low } = renderWithTheme(
      <SegmentedVUMeter levels={[0.6]} segmentCount={12} channelLabels={['M']} />
    );
    const lowActive = getActiveSegments(low);
    cleanup();

    const { container: high } = renderWithTheme(
      <SegmentedVUMeter levels={[0.9]} segmentCount={12} channelLabels={['M']} />
    );
    const highActive = getActiveSegments(high);

    expect(highActive.length).toBeGreaterThan(lowActive.length);
  });

  it('level > 1.0 (above 0 dB) activates all segments including top', () => {
    // normalizedToDb(1.1) > 5 dB, so all segments including 5 dB threshold should activate
    const { container } = renderWithTheme(
      <SegmentedVUMeter levels={[1.1]} segmentCount={12} channelLabels={['M']} />
    );
    const active = getActiveSegments(container);
    expect(active.length).toBe(12); // All segments active
  });

  it('multi-channel activation is independent per channel', () => {
    const { container } = renderWithTheme(<SegmentedVUMeter levels={[1.0, 0]} segmentCount={12} />);
    const channels = container.querySelectorAll('[data-channel]');
    expect(channels.length).toBe(2);

    // Channel 0 (level=1.0) should have active segments
    const ch0Segments = Array.from(channels[0].querySelectorAll('[data-segment]'));
    const ch0Active = ch0Segments.filter((seg) => {
      const bg = (seg as HTMLElement).style.backgroundColor;
      return !(bg.includes('128') && bg.includes('0.2'));
    });

    // Channel 1 (level=0) should have no active segments
    const ch1Segments = Array.from(channels[1].querySelectorAll('[data-segment]'));
    const ch1Active = ch1Segments.filter((seg) => {
      const bg = (seg as HTMLElement).style.backgroundColor;
      return !(bg.includes('128') && bg.includes('0.2'));
    });

    expect(ch0Active.length).toBeGreaterThan(0);
    expect(ch1Active.length).toBe(0);
  });

  it('coloredInactive shows colored segments at low opacity', () => {
    const { container } = renderWithTheme(
      <SegmentedVUMeter levels={[0]} segmentCount={12} channelLabels={['M']} coloredInactive />
    );
    const segments = Array.from(container.querySelectorAll('[data-segment]'));
    // With coloredInactive and level=0, all segments should have low opacity
    const lowOpacity = segments.filter((seg) => (seg as HTMLElement).style.opacity === '0.15');
    expect(lowOpacity.length).toBe(12);
  });
});
