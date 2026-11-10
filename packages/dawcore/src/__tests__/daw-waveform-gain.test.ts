import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';

// #662: a clip's waveform is drawn from its source audio, so a clip at
// +17 dB looked identical to one at 0 dB. <daw-waveform gain> scales the
// drawn bars; <daw-editor gain-scaled-waveforms> feeds it each clip's gain.

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
    rect: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
  };
}

beforeAll(async () => {
  await import('../elements/daw-waveform');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
  await import('../elements/daw-editor');
});

let mounted: HTMLElement[] = [];

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
  mounted.forEach((el) => el.remove());
  mounted = [];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Peaks at ±0.25 of full scale; waveHeight 128 → halfHeight 64.
const QUARTER = 8192;
const PEAKS = new Int16Array([-QUARTER, QUARTER, -QUARTER, QUARTER]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mountWaveform(setup: (el: any) => void): Promise<any> {
  const el = document.createElement('daw-waveform');
  setup(el);
  document.body.appendChild(el);
  mounted.push(el);
  await new Promise((r) => setTimeout(r, 50));
  return el;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawInto(wf: any) {
  const canvas = wf.shadowRoot.querySelector('canvas');
  const ctx = createMockCtx();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as any);
  return ctx;
}

describe('<daw-waveform> gain', () => {
  it('defaults to unity and draws source-level bars', async () => {
    const wf = await mountWaveform((w) => {
      w.length = 2;
    });
    expect(wf.gain).toBe(1);
    const ctx = drawInto(wf);

    wf.peaks = PEAKS;
    flushRaf();

    // ±0.25 × 64 = 16 above and below centre.
    expect(ctx.fillRect.mock.calls[0]).toEqual([0, 48, 1, 32]);
  });

  it('scales drawn bars by gain', async () => {
    const wf = await mountWaveform((w) => {
      w.length = 2;
      w.gain = 2;
    });
    const ctx = drawInto(wf);

    wf.peaks = PEAKS;
    flushRaf();

    expect(ctx.fillRect.mock.calls[0]).toEqual([0, 32, 1, 64]);
  });

  it('clamps boosted bars to the channel height', async () => {
    const wf = await mountWaveform((w) => {
      w.length = 2;
      w.gain = 10;
    });
    const ctx = drawInto(wf);

    wf.peaks = PEAKS;
    flushRaf();

    expect(ctx.fillRect.mock.calls[0]).toEqual([0, 0, 1, 128]);
  });

  it('redraws when gain changes, without new peaks', async () => {
    const wf = await mountWaveform((w) => {
      w.length = 2;
      w.peaks = PEAKS;
    });
    const ctx = drawInto(wf);
    flushRaf();
    ctx.fillRect.mockClear();

    wf.gain = 2;
    await wf.updateComplete;
    flushRaf();

    expect(ctx.fillRect.mock.calls[0]).toEqual([0, 32, 1, 64]);
  });

  it('scales the per-segment (beats mode) draw path too', async () => {
    const wf = await mountWaveform((w) => {
      w.length = 2;
      w.gain = 2;
      w.segments = [{ peakStart: 0, peakEnd: 2, pixelStart: 0, pixelEnd: 2 }];
    });
    const ctx = drawInto(wf);

    wf.peaks = PEAKS;
    flushRaf();

    expect(ctx.fillRect.mock.calls[0]).toEqual([0, 32, 1, 64]);
  });
});

describe('<daw-editor gain-scaled-waveforms>', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function setupEditor(attrs: Record<string, string> = {}): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = document.createElement('daw-editor') as any;
    for (const [k, v] of Object.entries(attrs)) editor.setAttribute(k, v);
    editor.adapter = { audioContext: { state: 'running', sampleRate: 48000 } };
    document.body.appendChild(editor);
    mounted.push(editor);
    const clip = (id: string, startSample: number, gain: number) => ({
      id,
      startSample,
      durationSamples: 48000,
      offsetSamples: 0,
      sampleRate: 48000,
      sourceDurationSamples: 48000,
      gain,
      name: id,
    });
    editor._engineTracks = new Map([
      ['t1', { id: 't1', name: 'T', clips: [clip('loud', 0, 2), clip('unity', 48000, 1)] }],
    ]);
    return editor;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function waveformGains(editor: any): number[] {
    return [...editor.shadowRoot.querySelectorAll('daw-waveform')].map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (w: any) => w.gain
    );
  }

  it('defaults to false and parses the attribute', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor = document.createElement('daw-editor') as any;
    expect(editor.gainScaledWaveforms).toBe(false);
    editor.setAttribute('gain-scaled-waveforms', '');
    expect(editor.gainScaledWaveforms).toBe(true);
  });

  it('draws every clip at source level by default', async () => {
    const editor = setupEditor();
    await editor.updateComplete;

    expect(waveformGains(editor)).toEqual([1, 1]);
  });

  it('passes each clip its own gain when enabled', async () => {
    const editor = setupEditor({ 'gain-scaled-waveforms': '' });
    await editor.updateComplete;

    expect(waveformGains(editor)).toEqual([2, 1]);
  });

  it('follows the attribute being toggled at runtime', async () => {
    const editor = setupEditor();
    await editor.updateComplete;

    editor.gainScaledWaveforms = true;
    await editor.updateComplete;
    expect(waveformGains(editor)).toEqual([2, 1]);

    editor.gainScaledWaveforms = false;
    await editor.updateComplete;
    expect(waveformGains(editor)).toEqual([1, 1]);
  });
});
