import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';

let rafCallbacks: Array<(time: number) => void>;

function flushRaf() {
  const cbs = rafCallbacks.splice(0);
  cbs.forEach((cb) => cb(performance.now()));
}

beforeAll(async () => {
  await import('../elements/daw-waveform');
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

describe('DawWaveformElement', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-waveform')).toBeDefined();
  });

  it('has default property values', () => {
    const el = document.createElement('daw-waveform') as any;
    expect(el.waveHeight).toBe(128);
    expect(el.barWidth).toBe(1);
    expect(el.barGap).toBe(0);
    expect(el.length).toBe(0);
    expect(el.peaks).toBeInstanceOf(Int16Array);
    expect(el.peaks.length).toBe(0);
  });

  it('derives bits=8 from Int8Array peaks', () => {
    const el = document.createElement('daw-waveform') as any;
    el.peaks = new Int8Array([0, 10, -5, 20]);
    expect(el.bits).toBe(8);
  });

  it('derives bits=16 from Int16Array peaks (default)', () => {
    const el = document.createElement('daw-waveform') as any;
    expect(el.bits).toBe(16);
    el.peaks = new Int16Array([0, 1000, -500, 2000]);
    expect(el.bits).toBe(16);
  });

  it('uses Shadow DOM', () => {
    const el = document.createElement('daw-waveform') as any;
    document.body.appendChild(el);
    expect(el.shadowRoot).toBeTruthy();
    document.body.removeChild(el);
  });

  it('calls clearRect on full canvas width when peaks are set', async () => {
    const el = document.createElement('daw-waveform') as any;
    el.length = 100;
    document.body.appendChild(el);

    // Wait for Lit render to create canvas elements
    await new Promise((r) => setTimeout(r, 50));

    const canvas = el.shadowRoot?.querySelector('canvas');
    expect(canvas).toBeTruthy();

    // happy-dom returns null for getContext('2d') — install a mock context
    const mockCtx = {
      clearRect: vi.fn(),
      resetTransform: vi.fn(),
      scale: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
    };
    vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx as any);

    // Set peaks — marks all dirty
    el.peaks = new Int16Array([0, 100, -50, 200, 0, 150, -100, 300]);
    flushRaf();

    expect(mockCtx.clearRect).toHaveBeenCalled();
    // clearRect should cover the full canvas width (4 peak pairs = 4 pixels)
    const [, , width] = mockCtx.clearRect.mock.calls[0];
    expect(width).toBeGreaterThan(0);

    document.body.removeChild(el);
  });

  it('updatePeaks marks only the specified range dirty', async () => {
    const el = document.createElement('daw-waveform') as any;
    el.length = 200;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));

    // Set initial peaks (10 pairs = 10 pixels)
    el.peaks = new Int16Array(20);
    flushRaf(); // flush the full draw

    const canvas = el.shadowRoot?.querySelector('canvas');
    expect(canvas).toBeTruthy();

    const mockCtx = {
      clearRect: vi.fn(),
      resetTransform: vi.fn(),
      scale: vi.fn(),
      fillStyle: '',
      fillRect: vi.fn(),
    };
    vi.spyOn(canvas!, 'getContext').mockReturnValue(mockCtx as any);

    // Incremental update: only pixels 8-9 changed
    el.updatePeaks(8, 10);
    flushRaf();

    expect(mockCtx.clearRect).toHaveBeenCalled();
    // clearRect x should be near pixel 8, NOT 0 (dpr=1)
    const [x] = mockCtx.clearRect.mock.calls[0];
    expect(x).toBeGreaterThanOrEqual(8);

    document.body.removeChild(el);
  });

  it('batches multiple updatePeaks into single rAF draw', async () => {
    const el = document.createElement('daw-waveform') as any;
    el.length = 200;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));

    el.peaks = new Int16Array(20);
    flushRaf();

    const canvas = el.shadowRoot?.querySelector('canvas');
    expect(canvas).toBeTruthy();

    const mockCtx = {
      clearRect: vi.fn(),
      resetTransform: vi.fn(),
      scale: vi.fn(),
      fillStyle: '',
      fillRect: vi.fn(),
    };
    vi.spyOn(canvas!, 'getContext').mockReturnValue(mockCtx as any);

    // Two incremental updates before rAF fires
    el.updatePeaks(2, 4);
    el.updatePeaks(7, 9);
    flushRaf();

    // Should be one clearRect call covering the merged range
    expect(mockCtx.clearRect).toHaveBeenCalledTimes(1);
    const [x, , width] = mockCtx.clearRect.mock.calls[0];
    // Should cover from pixel 2 to at least pixel 9
    expect(x).toBeLessThanOrEqual(2);
    expect(x + width).toBeGreaterThanOrEqual(9);

    document.body.removeChild(el);
  });

  it('marks all dirty when waveHeight changes', async () => {
    const el = document.createElement('daw-waveform') as any;
    el.length = 100;
    el.peaks = new Int16Array([0, 100, -50, 200, 0, 150, -100, 300]);
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));
    flushRaf(); // initial draw

    const canvas = el.shadowRoot?.querySelector('canvas');
    expect(canvas).toBeTruthy();

    const mockCtx = {
      clearRect: vi.fn(),
      resetTransform: vi.fn(),
      scale: vi.fn(),
      fillStyle: '',
      fillRect: vi.fn(),
    };
    vi.spyOn(canvas!, 'getContext').mockReturnValue(mockCtx as any);

    el.waveHeight = 256;
    await new Promise((r) => setTimeout(r, 50));
    flushRaf();

    expect(mockCtx.clearRect).toHaveBeenCalled();
    document.body.removeChild(el);
  });

  it('setPeaksQuiet replaces peaks without marking all dirty', async () => {
    const el = document.createElement('daw-waveform') as any;
    el.length = 200;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));

    // Set initial peaks (full draw)
    el.peaks = new Int16Array([0, 100, -50, 200, 0, 150, -100, 300]);
    flushRaf();

    const canvas = el.shadowRoot?.querySelector('canvas');
    expect(canvas).toBeTruthy();

    const mockCtx = {
      clearRect: vi.fn(),
      resetTransform: vi.fn(),
      scale: vi.fn(),
      fillStyle: '',
      fillRect: vi.fn(),
    };
    vi.spyOn(canvas!, 'getContext').mockReturnValue(mockCtx as any);

    // setPeaksQuiet should NOT trigger a draw
    const longerPeaks = new Int16Array([0, 100, -50, 200, 0, 150, -100, 300, 0, 50, -25, 100]);
    el.setPeaksQuiet(longerPeaks);
    flushRaf();

    // No clearRect called — peaks replaced silently
    expect(mockCtx.clearRect).not.toHaveBeenCalled();
    // But the peaks reference is updated
    expect(el.peaks).toBe(longerPeaks);
    expect(el.bits).toBe(16);

    document.body.removeChild(el);
  });

  it('skips draw when dirty set is empty', async () => {
    const el = document.createElement('daw-waveform') as any;
    el.length = 100;
    document.body.appendChild(el);

    // Wait for Lit render to create canvas elements
    await new Promise((r) => setTimeout(r, 50));

    // Flush any pending draws from mount
    flushRaf();

    const canvas = el.shadowRoot?.querySelector('canvas');
    expect(canvas).toBeTruthy();

    const mockCtx = {
      clearRect: vi.fn(),
      resetTransform: vi.fn(),
      scale: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
    };
    vi.spyOn(canvas!, 'getContext').mockReturnValue(mockCtx as any);

    // No peaks set, no updatePeaks called — dirty set should be empty
    flushRaf();
    expect(mockCtx.clearRect).not.toHaveBeenCalled();

    document.body.removeChild(el);
  });
});
