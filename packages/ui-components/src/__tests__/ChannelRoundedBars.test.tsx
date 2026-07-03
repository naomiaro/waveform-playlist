import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Channel } from '../components/Channel';

/**
 * Mock 2d context for jsdom (getContext returns null natively).
 * Records the sequence of globalCompositeOperation assignments so tests
 * can assert the destination-out punch ordering.
 */
function createMockCtx() {
  const compositeOps: string[] = [];
  let composite = 'source-over';
  const ctx = {
    resetTransform: vi.fn(),
    clearRect: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    imageSmoothingEnabled: false,
    fillStyle: '',
    compositeOps,
  };
  Object.defineProperty(ctx, 'globalCompositeOperation', {
    get: () => composite,
    set: (value: string) => {
      composite = value;
      compositeOps.push(value);
    },
  });
  return ctx as unknown as CanvasRenderingContext2D & { compositeOps: string[] };
}

// 4 peaks at ±0.5 amplitude (bits 8 → normalized by 128): [-64, 64] each.
// With barWidth 3 + barGap 1 (step 4) and length 8, exactly one bar is drawn
// (bar at x=0 aggregates peaks 0-3; bar at x=4 has no peaks → skipped).
const PEAKS = new Int8Array([-64, 64, -64, 64, -64, 64, -64, 64]);

const baseProps = {
  index: 0,
  data: PEAKS,
  bits: 8 as const,
  length: 8,
  waveHeight: 80,
  barWidth: 3,
  barGap: 1,
};

describe('Channel roundedBars', () => {
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

  it('draws plain fillRect bars by default (no roundRect)', () => {
    render(<Channel {...baseProps} drawMode="normal" />);

    expect(mockCtx.fillRect).toHaveBeenCalled();
    expect(mockCtx.roundRect).not.toHaveBeenCalled();
  });

  it('draws rounded bars via roundRect with radius barWidth/2 in normal mode', () => {
    render(<Channel {...baseProps} drawMode="normal" roundedBars />);

    // Bar at x=0: peaks ±0.5 × halfHeight 40 → y=20, height=40
    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.roundRect).toHaveBeenCalledTimes(1);
    expect(mockCtx.roundRect).toHaveBeenCalledWith(0, 20, 3, 40, 1.5);
    expect(mockCtx.fill).toHaveBeenCalled();
    // No fillRect bars and no pre-fill in normal mode
    expect(mockCtx.fillRect).not.toHaveBeenCalled();
  });

  it('pre-fills and punches rounded bars via destination-out in inverted mode', () => {
    render(<Channel {...baseProps} drawMode="inverted" roundedBars />);

    // Pre-fill covers the full chunk (8px wide, 80px tall)
    expect(mockCtx.fillRect).toHaveBeenCalledTimes(1);
    expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 8, 80);

    // Punch uses the normal-mode bar rect
    expect(mockCtx.roundRect).toHaveBeenCalledTimes(1);
    expect(mockCtx.roundRect).toHaveBeenCalledWith(0, 20, 3, 40, 1.5);

    // Composite mode switched to destination-out for the punch, then restored
    expect(mockCtx.compositeOps).toEqual(['destination-out', 'source-over']);
  });

  it('keeps existing inverted rendering when roundedBars is off', () => {
    render(<Channel {...baseProps} drawMode="inverted" />);

    // Inverted mode without rounding: two gap rects per bar, no compositing
    expect(mockCtx.fillRect).toHaveBeenCalledTimes(2);
    expect(mockCtx.roundRect).not.toHaveBeenCalled();
    expect(mockCtx.compositeOps).toEqual([]);
  });
});
