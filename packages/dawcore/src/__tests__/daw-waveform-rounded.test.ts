import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';

let rafCallbacks: Array<(time: number) => void>;

function flushRaf() {
  const cbs = rafCallbacks.splice(0);
  cbs.forEach((cb) => cb(performance.now()));
}

function createMockCtx() {
  return {
    clearRect: vi.fn(),
    resetTransform: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
  };
}

beforeAll(async () => {
  await import('../elements/daw-waveform');
  await import('../elements/daw-player');
  await import('../elements/daw-editor');
});

beforeEach(() => {
  rafCallbacks = [];
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((cb: (time: number) => void) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    })
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('devicePixelRatio', 1);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DawWaveformElement roundedBars', () => {
  it('defaults roundedBars to false', () => {
    const el = document.createElement('daw-waveform') as any;
    expect(el.roundedBars).toBe(false);
  });

  it('draws plain fillRect bars by default (no roundRect)', async () => {
    const el = document.createElement('daw-waveform') as any;
    el.length = 100;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));

    const canvas = el.shadowRoot?.querySelector('canvas');
    expect(canvas).toBeTruthy();
    const mockCtx = createMockCtx();
    vi.spyOn(canvas!, 'getContext').mockReturnValue(mockCtx as any);

    el.peaks = new Int16Array([0, 16384, -16384, 16384, 0, 16384, -16384, 16384]);
    flushRaf();

    expect(mockCtx.fillRect).toHaveBeenCalled();
    expect(mockCtx.roundRect).not.toHaveBeenCalled();

    document.body.removeChild(el);
  });

  it('draws rounded bars via roundRect with radius barWidth/2', async () => {
    const el = document.createElement('daw-waveform') as any;
    el.length = 100;
    el.barWidth = 4;
    el.barGap = 2;
    el.roundedBars = true;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));

    const canvas = el.shadowRoot?.querySelector('canvas');
    expect(canvas).toBeTruthy();
    const mockCtx = createMockCtx();
    vi.spyOn(canvas!, 'getContext').mockReturnValue(mockCtx as any);

    // Peaks at ±0.5 (16384/32768) → with waveHeight 128, halfHeight 64: y=32, h=64
    el.peaks = new Int16Array([-16384, 16384, -16384, 16384, -16384, 16384, -16384, 16384]);
    flushRaf();

    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.roundRect).toHaveBeenCalled();
    const [x, y, w, h, radius] = mockCtx.roundRect.mock.calls[0];
    expect(x).toBe(0);
    expect(y).toBe(32);
    expect(w).toBe(4);
    expect(h).toBe(64);
    expect(radius).toBe(2);
    expect(mockCtx.fill).toHaveBeenCalled();
    expect(mockCtx.fillRect).not.toHaveBeenCalled();

    document.body.removeChild(el);
  });

  it('triggers a full redraw when roundedBars changes', async () => {
    const el = document.createElement('daw-waveform') as any;
    el.length = 100;
    el.peaks = new Int16Array([0, 16384, -16384, 16384, 0, 16384, -16384, 16384]);
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));
    flushRaf(); // initial draw

    const canvas = el.shadowRoot?.querySelector('canvas');
    expect(canvas).toBeTruthy();
    const mockCtx = createMockCtx();
    vi.spyOn(canvas!, 'getContext').mockReturnValue(mockCtx as any);

    el.roundedBars = true;
    await new Promise((r) => setTimeout(r, 50));
    flushRaf();

    expect(mockCtx.clearRect).toHaveBeenCalled();
    expect(mockCtx.roundRect).toHaveBeenCalled();

    document.body.removeChild(el);
  });
});

describe('rounded-bars attribute parsing', () => {
  it('daw-player: defaults false, parses the rounded-bars attribute', () => {
    const el = document.createElement('daw-player') as any;
    expect(el.roundedBars).toBe(false);
    el.setAttribute('rounded-bars', '');
    expect(el.roundedBars).toBe(true);
  });

  it('daw-editor: defaults false, parses the rounded-bars attribute', () => {
    const el = document.createElement('daw-editor') as any;
    expect(el.roundedBars).toBe(false);
    el.setAttribute('rounded-bars', '');
    expect(el.roundedBars).toBe(true);
  });
});
