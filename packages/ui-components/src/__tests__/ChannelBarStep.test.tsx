import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Channel } from '../components/Channel';
import { barStep } from '../utils/peakRendering';
import { PlaylistInfoContext, usePlaylistInfo } from '../contexts/PlaylistInfo';

// #689: the distance from one bar to the next is at least one pixel. With a
// step of 0 the first bar position was NaN and nothing was drawn; with a
// negative step the loop over the bars would not end.

function createMockCtx() {
  return {
    resetTransform: vi.fn(),
    clearRect: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    imageSmoothingEnabled: false,
    fillStyle: '',
  };
}

const PEAKS = new Int8Array([-32, 32, -32, 32, -32, 32, -32, 32]);
const baseProps = {
  index: 0,
  data: PEAKS,
  bits: 8 as const,
  length: 4,
  waveHeight: 80,
  drawMode: 'normal' as const,
};

describe('barStep', () => {
  it('is the bar and its gap', () => {
    expect(barStep(1, 0)).toBe(1);
    expect(barStep(4, 2)).toBe(6);
    expect(barStep(1.5, 0)).toBe(1.5);
  });

  it('is one pixel when the bar and its gap come to less, or to no number', () => {
    expect(barStep(0, 0)).toBe(1);
    expect(barStep(2, -5)).toBe(1);
    expect(barStep(0.25, 0.25)).toBe(1);
    expect(barStep(Number.NaN, 0)).toBe(1);
  });
});

describe('Channel with bars that give no step', () => {
  let mockCtx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    mockCtx = createMockCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx as unknown as CanvasRenderingContext2D
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('draws one bar per pixel for a bar and gap that come to 0', () => {
    render(<Channel {...baseProps} barWidth={1} barGap={-1} />);
    expect(mockCtx.fillRect.mock.calls.map((call) => call[0])).toEqual([0, 1, 2, 3]);
  });

  it('ends for a negative step', () => {
    render(<Channel {...baseProps} barWidth={2} barGap={-5} />);
    expect(mockCtx.fillRect.mock.calls.map((call) => call[0])).toEqual([0, 1, 2, 3]);
  });
});

describe('PlaylistInfoContext', () => {
  it('has exactly the fields a view draws with, and their defaults', () => {
    let info: ReturnType<typeof usePlaylistInfo> | undefined;
    const Reader = () => {
      info = usePlaylistInfo();
      return null;
    };
    render(<Reader />);
    expect(info).toEqual({
      sampleRate: 48000,
      samplesPerPixel: 1000,
      waveHeight: 80,
      timeScaleHeight: 15,
      barWidth: 1,
      barGap: 0,
      roundedBars: false,
      progressBarWidth: 1,
    });
    expect(PlaylistInfoContext).toBeDefined();
  });
});
