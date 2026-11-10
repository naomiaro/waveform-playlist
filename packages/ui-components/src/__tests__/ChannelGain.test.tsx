import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Channel } from '../components/Channel';

// #662: a clip's waveform is drawn from source audio, so a clip at +17 dB
// looked identical to one at 0 dB. `gain` scales the drawn bars.

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

// Peaks at ±0.25 (bits 8 → normalized by 128). waveHeight 80 → halfHeight 40,
// so a source-level bar is 10px above and below centre.
const PEAKS = new Int8Array([-32, 32, -32, 32]);

const baseProps = {
  index: 0,
  data: PEAKS,
  bits: 8 as const,
  length: 2,
  waveHeight: 80,
  drawMode: 'normal' as const,
};

describe('Channel gain', () => {
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

  it('draws source-level bars by default', () => {
    render(<Channel {...baseProps} />);

    expect(mockCtx.fillRect.mock.calls[0]).toEqual([0, 30, 1, 20]);
  });

  it('scales drawn bars by gain', () => {
    render(<Channel {...baseProps} gain={2} />);

    expect(mockCtx.fillRect.mock.calls[0]).toEqual([0, 20, 1, 40]);
  });

  it('clamps boosted bars to the channel height', () => {
    render(<Channel {...baseProps} gain={10} />);

    expect(mockCtx.fillRect.mock.calls[0]).toEqual([0, 0, 1, 80]);
  });

  it('redraws when only gain changes (same peaks reference)', () => {
    const { rerender } = render(<Channel {...baseProps} />);
    mockCtx.fillRect.mockClear();

    rerender(<Channel {...baseProps} gain={0.5} />);

    expect(mockCtx.fillRect.mock.calls[0]).toEqual([0, 35, 1, 10]);
  });

  it('scales the inverted (default theme) draw mode too', () => {
    render(<Channel {...baseProps} drawMode="inverted" gain={2} />);

    // Inverted draws the gaps: top gap 0→20, bottom gap 60→80.
    expect(mockCtx.fillRect.mock.calls.slice(0, 2)).toEqual([
      [0, 0, 1, 20],
      [0, 60, 1, 20],
    ]);
  });
});
