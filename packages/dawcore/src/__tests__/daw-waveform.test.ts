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
});
