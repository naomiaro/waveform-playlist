import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { defaultTheme } from '../wfpl-theme';
import { SegmentedVUMeter } from '../components/SegmentedVUMeter';

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={defaultTheme}>{ui}</ThemeProvider>);

describe('SegmentedVUMeter', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders correct number of segments per channel', () => {
    const { container } = renderWithTheme(
      <SegmentedVUMeter levels={[0.5, 0.3]} segmentCount={12} />
    );
    const segments = container.querySelectorAll('[data-segment]');
    expect(segments.length).toBe(24); // 2 channels x 12 segments
  });

  it('renders channel labels', () => {
    renderWithTheme(<SegmentedVUMeter levels={[0.5, 0.3]} channelLabels={['L', 'R']} />);
    expect(screen.getByText('L')).toBeTruthy();
    expect(screen.getByText('R')).toBeTruthy();
  });

  it('defaults to L/R labels for 2 channels', () => {
    renderWithTheme(<SegmentedVUMeter levels={[0.5, 0.3]} />);
    expect(screen.getByText('L')).toBeTruthy();
    expect(screen.getByText('R')).toBeTruthy();
  });

  it('renders single channel', () => {
    const { container } = renderWithTheme(
      <SegmentedVUMeter levels={[0.5]} channelLabels={['M']} />
    );
    expect(screen.getByText('M')).toBeTruthy();
    const channels = container.querySelectorAll('[data-channel]');
    expect(channels.length).toBe(1);
  });

  it('renders dB scale labels when showScale is true', () => {
    renderWithTheme(<SegmentedVUMeter levels={[0.5, 0.3]} showScale />);
    // Check that at least one numeric dB label is rendered
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('hides dB scale labels when showScale is false', () => {
    renderWithTheme(<SegmentedVUMeter levels={[0.5, 0.3]} showScale={false} />);
    // Should not have scale column
    expect(screen.queryByText('-20')).toBeNull();
  });

  it('renders peak indicators when peakLevels provided', () => {
    const { container } = renderWithTheme(
      <SegmentedVUMeter levels={[0.3]} peakLevels={[0.8]} channelLabels={['M']} />
    );
    const peaks = container.querySelectorAll('[data-peak]');
    expect(peaks.length).toBe(1);
  });

  it('applies orientation data attribute', () => {
    const { container } = renderWithTheme(
      <SegmentedVUMeter levels={[0.5]} orientation="horizontal" channelLabels={['M']} />
    );
    const meter = container.querySelector('[data-meter-orientation="horizontal"]');
    expect(meter).toBeTruthy();
  });
});
