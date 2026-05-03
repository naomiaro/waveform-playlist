import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';

let rafCallbacks: Array<(time: number) => void>;

function flushRaf() {
  const cbs = rafCallbacks.splice(0);
  cbs.forEach((cb) => cb(performance.now()));
}

beforeAll(async () => {
  await import('../elements/daw-piano-roll');
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

describe('DawPianoRollElement', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-piano-roll')).toBeDefined();
  });

  it('uses Shadow DOM', () => {
    const el = document.createElement('daw-piano-roll') as any;
    document.body.appendChild(el);
    expect(el.shadowRoot).toBeTruthy();
    document.body.removeChild(el);
  });

  it('has default property values', () => {
    const el = document.createElement('daw-piano-roll') as any;
    expect(el.midiNotes).toEqual([]);
    expect(el.length).toBe(0);
    expect(el.waveHeight).toBe(128);
    expect(el.samplesPerPixel).toBe(1024);
    expect(el.sampleRate).toBe(48000);
    expect(el.clipOffsetSeconds).toBe(0);
  });

  it('renders chunked canvases based on length', async () => {
    const el = document.createElement('daw-piano-roll') as any;
    el.length = 2500; // 1000 + 1000 + 500 → 3 chunks
    document.body.appendChild(el);
    await el.updateComplete;
    flushRaf();

    const canvases = el.shadowRoot.querySelectorAll('canvas');
    expect(canvases.length).toBe(3);
    document.body.removeChild(el);
  });

  it('draws notes when midiNotes is set', async () => {
    const fillRect = vi.fn();
    const mockCtx = {
      clearRect: vi.fn(),
      resetTransform: vi.fn(),
      scale: vi.fn(),
      fillRect,
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      fillStyle: '',
      globalAlpha: 1,
      imageSmoothingEnabled: false,
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);

    const el = document.createElement('daw-piano-roll') as any;
    el.length = 1000;
    el.sampleRate = 48000;
    el.samplesPerPixel = 1024;
    el.midiNotes = [
      { midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 },
      { midi: 64, name: 'E4', time: 0.5, duration: 0.5, velocity: 0.6 },
    ];
    document.body.appendChild(el);
    await el.updateComplete;
    flushRaf();

    expect(mockCtx.clearRect).toHaveBeenCalled();
    expect(mockCtx.fill).toHaveBeenCalledTimes(2); // one per note
    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('skips notes outside the visible chunk time range', async () => {
    const mockCtx = {
      clearRect: vi.fn(),
      resetTransform: vi.fn(),
      scale: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      fillStyle: '',
      globalAlpha: 1,
      imageSmoothingEnabled: false,
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);

    const el = document.createElement('daw-piano-roll') as any;
    el.length = 1000;
    el.sampleRate = 48000;
    el.samplesPerPixel = 48; // 1px = 1ms
    // Note at time=10s — outside the 0..1000ms chunk
    el.midiNotes = [{ midi: 60, name: 'C4', time: 10, duration: 0.1, velocity: 0.5 }];
    document.body.appendChild(el);
    await el.updateComplete;
    flushRaf();

    expect(mockCtx.fill).not.toHaveBeenCalled();
    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('rejects zero / negative / NaN samplesPerPixel and sampleRate', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const el = document.createElement('daw-piano-roll') as any;
      el.samplesPerPixel = 0;
      el.samplesPerPixel = -100;
      el.samplesPerPixel = NaN;
      expect(el.samplesPerPixel).toBe(1024); // default unchanged
      el.sampleRate = 0;
      el.sampleRate = -1;
      el.sampleRate = NaN;
      expect(el.sampleRate).toBe(48000); // default unchanged
      expect(warnSpy.mock.calls.length).toBeGreaterThanOrEqual(6);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('schedules a redraw when visibleStart/visibleEnd/originX change', async () => {
    const el = document.createElement('daw-piano-roll') as any;
    el.length = 2500;
    el.midiNotes = [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }];
    document.body.appendChild(el);

    await el.updateComplete;
    // Flush the initial willUpdate draw
    const initialCount = rafCallbacks.length;
    flushRaf();

    // Now scroll the viewport — should schedule another draw
    el.visibleStart = 1000;
    el.visibleEnd = 2000;
    await el.updateComplete;

    // updated() should have scheduled a new RAF for the viewport change
    expect(rafCallbacks.length).toBeGreaterThan(0);

    flushRaf();
    document.body.removeChild(el);

    // Suppress unused-variable warning
    void initialCount;
  });
});
