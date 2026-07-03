import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Channel } from '../components/Channel';

/**
 * Mock 2d context for jsdom (getContext returns null natively).
 * Records the sequence of globalCompositeOperation assignments so tests
 * can assert the draw never mutates compositing state.
 */
function createMockCtx({ withRoundRect = true }: { withRoundRect?: boolean } = {}) {
  const compositeOps: string[] = [];
  let composite = 'source-over';
  const ctx: Record<string, unknown> = {
    resetTransform: vi.fn(),
    clearRect: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    imageSmoothingEnabled: false,
    fillStyle: '',
    compositeOps,
  };
  if (withRoundRect) {
    ctx.roundRect = vi.fn();
  }
  Object.defineProperty(ctx, 'globalCompositeOperation', {
    get: () => composite,
    set: (value: string) => {
      composite = value;
      compositeOps.push(value);
    },
  });
  return ctx as unknown as CanvasRenderingContext2D & {
    compositeOps: string[];
    roundRect?: ReturnType<typeof vi.fn>;
    rect: ReturnType<typeof vi.fn>;
    fill: ReturnType<typeof vi.fn>;
    fillRect: ReturnType<typeof vi.fn>;
    beginPath: ReturnType<typeof vi.fn>;
  };
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

  const installCtx = (ctx: ReturnType<typeof createMockCtx>) => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D
    );
  };

  beforeEach(() => {
    mockCtx = createMockCtx();
    installCtx(mockCtx);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('draws plain fillRect bars by default (no rounded path)', () => {
    render(<Channel {...baseProps} drawMode="normal" />);

    expect(mockCtx.fillRect).toHaveBeenCalled();
    expect(mockCtx.roundRect).not.toHaveBeenCalled();
    expect(mockCtx.fill).not.toHaveBeenCalled();
  });

  it('batches rounded bars into one path with radius barWidth/2 in normal mode', () => {
    render(<Channel {...baseProps} drawMode="normal" roundedBars />);

    // Bar at x=0: peaks ±0.5 × halfHeight 40 → y=20, height=40
    expect(mockCtx.beginPath).toHaveBeenCalledTimes(1);
    expect(mockCtx.roundRect).toHaveBeenCalledTimes(1);
    expect(mockCtx.roundRect).toHaveBeenCalledWith(0, 20, 3, 40, 1.5);
    // One fill for the whole chunk, default winding
    expect(mockCtx.fill).toHaveBeenCalledTimes(1);
    expect(mockCtx.fill).toHaveBeenCalledWith();
    // No per-bar fillRect and no compositing tricks
    expect(mockCtx.fillRect).not.toHaveBeenCalled();
    expect(mockCtx.compositeOps).toEqual([]);
  });

  it('draws multiple rounded bars as ONE path with a single fill', () => {
    // 8 peaks → bars at x=0 and x=4 both have data (step 4, barWidth 3)
    const twoBarPeaks = new Int8Array([
      -64, 64, -64, 64, -64, 64, -64, 64, -64, 64, -64, 64, -64, 64, -64, 64,
    ]);
    render(<Channel {...baseProps} data={twoBarPeaks} length={8} drawMode="normal" roundedBars />);

    expect(mockCtx.roundRect).toHaveBeenCalledTimes(2);
    expect(mockCtx.beginPath).toHaveBeenCalledTimes(1);
    expect(mockCtx.fill).toHaveBeenCalledTimes(1);
  });

  it('paints the complement via full-rect + bar subpaths with evenodd in inverted mode', () => {
    render(<Channel {...baseProps} drawMode="inverted" roundedBars />);

    // Full chunk rect (8px wide, 80px tall) plus the bar hole in ONE path
    expect(mockCtx.beginPath).toHaveBeenCalledTimes(1);
    expect(mockCtx.rect).toHaveBeenCalledWith(0, 0, 8, 80);
    expect(mockCtx.roundRect).toHaveBeenCalledTimes(1);
    expect(mockCtx.roundRect).toHaveBeenCalledWith(0, 20, 3, 40, 1.5);
    // Single evenodd fill leaves the bar interior unpainted — correct even
    // for semi-transparent outline colors (no destination-out residue)
    expect(mockCtx.fill).toHaveBeenCalledTimes(1);
    expect(mockCtx.fill).toHaveBeenCalledWith('evenodd');
    expect(mockCtx.fillRect).not.toHaveBeenCalled();
    // Compositing state is never touched
    expect(mockCtx.compositeOps).toEqual([]);
  });

  it('falls back to square corners when ctx.roundRect is unavailable', () => {
    const noRoundRectCtx = createMockCtx({ withRoundRect: false });
    installCtx(noRoundRectCtx);

    render(<Channel {...baseProps} drawMode="inverted" roundedBars />);

    // Bar added with rect() instead of throwing; chunk rect + bar rect
    expect(noRoundRectCtx.rect).toHaveBeenCalledWith(0, 0, 8, 80);
    expect(noRoundRectCtx.rect).toHaveBeenCalledWith(0, 20, 3, 40);
    expect(noRoundRectCtx.fill).toHaveBeenCalledWith('evenodd');
  });

  it('keeps existing inverted rendering when roundedBars is off', () => {
    render(<Channel {...baseProps} drawMode="inverted" />);

    // Inverted mode without rounding: two gap rects per bar, no path fill
    expect(mockCtx.fillRect).toHaveBeenCalledTimes(2);
    expect(mockCtx.roundRect).not.toHaveBeenCalled();
    expect(mockCtx.fill).not.toHaveBeenCalled();
    expect(mockCtx.compositeOps).toEqual([]);
  });
});
