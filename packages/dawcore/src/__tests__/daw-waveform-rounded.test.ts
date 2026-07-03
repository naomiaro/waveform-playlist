import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';

let rafCallbacks: Array<(time: number) => void>;

function flushRaf() {
  const cbs = rafCallbacks.splice(0);
  cbs.forEach((cb) => cb(performance.now()));
}

function createMockCtx({ withRoundRect = true }: { withRoundRect?: boolean } = {}) {
  const ctx: Record<string, unknown> = {
    clearRect: vi.fn(),
    resetTransform: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
  };
  if (withRoundRect) {
    ctx.roundRect = vi.fn();
  }
  return ctx as Record<string, ReturnType<typeof vi.fn>>;
}

beforeAll(async () => {
  await import('../elements/daw-waveform');
  await import('../elements/daw-player');
  await import('../elements/daw-editor');
});

let el: HTMLElement | null = null;

/** Create a daw-waveform, append it, and wait for Lit to render canvases. */
async function mountWaveform(setup: (el: any) => void): Promise<any> {
  el = document.createElement('daw-waveform');
  setup(el);
  document.body.appendChild(el);
  await new Promise((r) => setTimeout(r, 50));
  return el;
}

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
  // Cleanup in afterEach, never at the end of a test body — a failed
  // assertion must not leave a connected element poisoning later tests.
  el?.remove();
  el = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('DawWaveformElement roundedBars', () => {
  it('defaults roundedBars to false', () => {
    const wf = document.createElement('daw-waveform') as any;
    expect(wf.roundedBars).toBe(false);
  });

  it('draws plain fillRect bars by default (no rounded path)', async () => {
    const wf = await mountWaveform((w) => {
      w.length = 100;
    });

    const canvas = wf.shadowRoot?.querySelector('canvas');
    expect(canvas).toBeTruthy();
    const mockCtx = createMockCtx();
    vi.spyOn(canvas!, 'getContext').mockReturnValue(mockCtx as any);

    wf.peaks = new Int16Array([0, 16384, -16384, 16384, 0, 16384, -16384, 16384]);
    flushRaf();

    expect(mockCtx.fillRect).toHaveBeenCalled();
    expect(mockCtx.roundRect).not.toHaveBeenCalled();
    expect(mockCtx.fill).not.toHaveBeenCalled();
  });

  it('batches rounded bars into one path with radius barWidth/2', async () => {
    const wf = await mountWaveform((w) => {
      w.length = 100;
      w.barWidth = 4;
      w.barGap = 2;
      w.roundedBars = true;
    });

    const canvas = wf.shadowRoot?.querySelector('canvas');
    expect(canvas).toBeTruthy();
    const mockCtx = createMockCtx();
    vi.spyOn(canvas!, 'getContext').mockReturnValue(mockCtx as any);

    // Peaks at ±0.5 (16384/32768) → with waveHeight 128, halfHeight 64: y=32, h=64
    wf.peaks = new Int16Array([-16384, 16384, -16384, 16384, -16384, 16384, -16384, 16384]);
    flushRaf();

    expect(mockCtx.beginPath).toHaveBeenCalledTimes(1);
    expect(mockCtx.roundRect).toHaveBeenCalled();
    const [x, y, w, h, radius] = mockCtx.roundRect.mock.calls[0];
    expect(x).toBe(0);
    expect(y).toBe(32);
    expect(w).toBe(4);
    expect(h).toBe(64);
    expect(radius).toBe(2);
    // One fill for the whole dirty-region draw
    expect(mockCtx.fill).toHaveBeenCalledTimes(1);
    expect(mockCtx.fillRect).not.toHaveBeenCalled();
  });

  it('falls back to square corners when ctx.roundRect is unavailable', async () => {
    const wf = await mountWaveform((w) => {
      w.length = 100;
      w.barWidth = 4;
      w.barGap = 2;
      w.roundedBars = true;
    });

    const canvas = wf.shadowRoot?.querySelector('canvas');
    expect(canvas).toBeTruthy();
    const mockCtx = createMockCtx({ withRoundRect: false });
    vi.spyOn(canvas!, 'getContext').mockReturnValue(mockCtx as any);

    wf.peaks = new Int16Array([-16384, 16384, -16384, 16384]);
    flushRaf();

    // No throw; bar added via rect() and filled
    expect(mockCtx.rect).toHaveBeenCalledWith(0, 32, 4, 64);
    expect(mockCtx.fill).toHaveBeenCalledTimes(1);
  });

  it('triggers a full redraw when roundedBars changes', async () => {
    const wf = await mountWaveform((w) => {
      w.length = 100;
      w.peaks = new Int16Array([0, 16384, -16384, 16384, 0, 16384, -16384, 16384]);
    });
    flushRaf(); // initial draw

    const canvas = wf.shadowRoot?.querySelector('canvas');
    expect(canvas).toBeTruthy();
    const mockCtx = createMockCtx();
    vi.spyOn(canvas!, 'getContext').mockReturnValue(mockCtx as any);

    wf.roundedBars = true;
    await new Promise((r) => setTimeout(r, 50));
    flushRaf();

    expect(mockCtx.clearRect).toHaveBeenCalled();
    expect(mockCtx.roundRect).toHaveBeenCalled();
  });
});

describe('rounded-bars attribute parsing', () => {
  it('daw-player: defaults false, parses the rounded-bars attribute', () => {
    const player = document.createElement('daw-player') as any;
    expect(player.roundedBars).toBe(false);
    player.setAttribute('rounded-bars', '');
    expect(player.roundedBars).toBe(true);
  });

  it('daw-editor: defaults false, parses the rounded-bars attribute', () => {
    const editor = document.createElement('daw-editor') as any;
    expect(editor.roundedBars).toBe(false);
    editor.setAttribute('rounded-bars', '');
    expect(editor.roundedBars).toBe(true);
  });
});
