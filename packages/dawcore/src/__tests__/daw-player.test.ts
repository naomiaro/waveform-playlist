import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import type { DawPlayerElement } from '../elements/daw-player';
import * as peaksLoader from '../interactions/peaks-loader';
import * as waveformDataUtils from '../workers/waveformDataUtils';

beforeAll(async () => {
  await import('../elements/daw-player');
});

function makePlayer(): DawPlayerElement {
  const el = document.createElement('daw-player') as DawPlayerElement;
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.querySelectorAll('daw-player').forEach((el) => el.remove());
  vi.restoreAllMocks();
});

describe('DawPlayerElement — scaffold', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-player')).toBeDefined();
  });

  it('uses Shadow DOM', async () => {
    const el = makePlayer();
    await el.updateComplete;
    expect(el.shadowRoot).toBeTruthy();
  });

  it('defaults: waveHeight 128, timescale false, mono false, barWidth 1, barGap 0, rate 1', () => {
    const el = makePlayer();
    expect(el.waveHeight).toBe(128);
    expect(el.timescale).toBe(false);
    expect(el.mono).toBe(false);
    expect(el.barWidth).toBe(1);
    expect(el.barGap).toBe(0);
    expect(el.playbackRate).toBe(1);
  });

  it('reads attributes into properties', async () => {
    const el = makePlayer();
    el.setAttribute('wave-height', '64');
    el.setAttribute('timescale', '');
    el.setAttribute('bar-width', '2');
    await el.updateComplete;
    expect(el.waveHeight).toBe(64);
    expect(el.timescale).toBe(true);
    expect(el.barWidth).toBe(2);
  });

  it('clamps playback-rate into 0.25–4.0 with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = makePlayer();
    el.playbackRate = 8;
    expect(el.playbackRate).toBe(4.0);
    el.playbackRate = 0.1;
    expect(el.playbackRate).toBe(0.25);
    expect(warn).toHaveBeenCalled();
  });
});

class MockAudio extends EventTarget {
  currentTime = 0;
  duration = 120;
  paused = true;
  ended = false;
  playbackRate = 1;
  volume = 1;
  muted = false;
  preservesPitch = true;
  preload = '';
  src = '';
  constructor(source?: string) {
    super();
    if (source) this.src = source;
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  load() {
    this.playbackRate = 1; // model the HTML load-algorithm reset
  }
}

describe('DawPlayerElement — playback wiring', () => {
  let OriginalAudio: typeof Audio;
  beforeAll(() => {
    OriginalAudio = globalThis.Audio;
    // @ts-expect-error test double
    globalThis.Audio = MockAudio;
  });

  afterAll(() => {
    globalThis.Audio = OriginalAudio;
  });

  function loaded(): DawPlayerElement {
    const el = makePlayer();
    el.src = 'episode.mp3';
    return el;
  }

  it('exposes the underlying audio element after src is set', async () => {
    const el = loaded();
    await el.updateComplete;
    expect(el.audioElement).toBeInstanceOf(MockAudio);
  });

  it('play()/pause()/stop() drive the engine', async () => {
    const el = loaded();
    await el.updateComplete;
    el.play();
    expect(el.isPlaying).toBe(true);
    el.pause();
    expect(el.isPlaying).toBe(false);
    el.stop();
    expect(el.audioElement!.currentTime).toBe(0);
  });

  it('seekTo() and currentTime setter move the element', async () => {
    const el = loaded();
    await el.updateComplete;
    el.seekTo(30);
    expect(el.audioElement!.currentTime).toBe(30);
    el.currentTime = 45;
    expect(el.audioElement!.currentTime).toBe(45);
  });

  it('setVolume clamps and reads back via volume', async () => {
    const el = loaded();
    await el.updateComplete;
    el.setVolume(0.5);
    expect(el.volume).toBe(0.5);
    el.setVolume(2);
    expect(el.volume).toBe(1);
  });

  it('duration reads from the engine', async () => {
    const el = loaded();
    await el.updateComplete;
    expect(el.duration).toBe(120);
  });

  it('changing src swaps the source in place', async () => {
    const el = loaded();
    await el.updateComplete;
    const first = el.audioElement;
    el.src = 'episode-2.mp3';
    await el.updateComplete;
    // in-place load() reuses the same element instance
    expect(el.audioElement).toBe(first);
    expect(el.audioElement!.src).toContain('episode-2.mp3');
  });

  describe('DawPlayerElement — events', () => {
    function loadedPlayer(): DawPlayerElement {
      const el = makePlayer();
      el.src = 'episode.mp3';
      return el;
    }

    it('dispatches daw-ready when metadata loads', async () => {
      const el = loadedPlayer();
      await el.updateComplete;
      const ready = vi.fn();
      el.addEventListener('daw-ready', ready);
      el.audioElement!.dispatchEvent(new Event('loadedmetadata'));
      expect(ready).toHaveBeenCalledTimes(1);
    });

    it('dispatches daw-play / daw-pause / daw-ended from native events', async () => {
      const el = loadedPlayer();
      await el.updateComplete;
      const play = vi.fn();
      const pause = vi.fn();
      const ended = vi.fn();
      el.addEventListener('daw-play', play);
      el.addEventListener('daw-pause', pause);
      el.addEventListener('daw-ended', ended);
      const audio = el.audioElement!;
      audio.dispatchEvent(new Event('play'));
      audio.dispatchEvent(new Event('pause'));
      audio.dispatchEvent(new Event('ended'));
      expect(play).toHaveBeenCalledTimes(1);
      expect(pause).toHaveBeenCalledTimes(1);
      expect(ended).toHaveBeenCalledTimes(1);
    });

    it('dispatches daw-error with operation:load on a media error', async () => {
      const el = loadedPlayer();
      await el.updateComplete;
      const onError = vi.fn();
      el.addEventListener('daw-error', onError);
      // MediaElementTrack emits error(audioElement.error); our MockAudio.error is undefined → null path
      el.audioElement!.dispatchEvent(new Event('error'));
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0].detail.operation).toBe('load');
    });

    it('dispatches daw-stop when stop() is called', async () => {
      const el = loadedPlayer();
      await el.updateComplete;
      const stop = vi.fn();
      el.addEventListener('daw-stop', stop);
      el.stop();
      expect(stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('daw-ready re-arm on src change (I1)', () => {
    it('fires daw-ready a second time after src-only swap', async () => {
      // No peaks-src → _peaksSettled=true immediately on first update
      const el = makePlayer();
      el.src = 'episode.mp3';
      await el.updateComplete;
      const ready = vi.fn();
      el.addEventListener('daw-ready', ready);
      // First loadedmetadata → daw-ready fires (count: 1)
      el.audioElement!.dispatchEvent(new Event('loadedmetadata'));
      expect(ready).toHaveBeenCalledTimes(1);
      // Swap src only (peaks-src unchanged/absent → _loadPeaks not re-called)
      el.src = 'episode-2.mp3';
      await el.updateComplete;
      // Fresh loadedmetadata for new source → daw-ready must fire again (count: 2)
      el.audioElement!.dispatchEvent(new Event('loadedmetadata'));
      expect(ready).toHaveBeenCalledTimes(2);
    });

    it('does not fire daw-ready prematurely when both src and peaks-src change (stale-metadata guard)', async () => {
      const minimalWd = { sample_rate: 48000 };
      // First peaks load resolves immediately
      vi.spyOn(peaksLoader, 'loadWaveformDataFromUrl').mockResolvedValue(minimalWd as never);
      const el = makePlayer();
      el.src = 'a.mp3';
      el.peaksSrc = 'a.dat';
      await el.updateComplete;
      const ready = vi.fn();
      el.addEventListener('daw-ready', ready);
      // Flush microtasks so first _loadPeaks async continuation runs (_peaksSettled=true)
      await Promise.resolve();
      await Promise.resolve();
      // Fire first loadedmetadata → daw-ready fires (count: 1)
      el.audioElement!.dispatchEvent(new Event('loadedmetadata'));
      expect(ready).toHaveBeenCalledTimes(1);

      // Set up a controlled (pending) peaks mock for the new source
      let resolveNewPeaks!: (v: unknown) => void;
      const newPeaksPromise = new Promise<unknown>((res) => {
        resolveNewPeaks = res;
      });
      vi.spyOn(peaksLoader, 'loadWaveformDataFromUrl').mockReturnValue(newPeaksPromise as never);
      // Swap both src and peaks-src in a single Lit update cycle
      el.src = 'b.mp3';
      el.peaksSrc = 'b.dat';
      await el.updateComplete;

      // Resolve new peaks BEFORE dispatching new loadedmetadata (the stale-metadata race)
      resolveNewPeaks(minimalWd);
      // Flush the awaited _loadPeaks continuation
      await Promise.resolve();
      await Promise.resolve();

      // BUG (pre-fix): _metadataLoaded stayed true from the old src, so daw-ready
      // would have fired prematurely here (count would be 2).
      // FIX: _loadSource resets _metadataLoaded=false so the gate stays closed.
      expect(ready).toHaveBeenCalledTimes(1);

      // Fresh loadedmetadata for new source → daw-ready now fires correctly (count: 2)
      el.audioElement!.dispatchEvent(new Event('loadedmetadata'));
      expect(ready).toHaveBeenCalledTimes(2);
    });
  });
});

describe('DawPlayerElement — seek interaction', () => {
  let OriginalAudio: typeof Audio;
  beforeAll(() => {
    OriginalAudio = globalThis.Audio;
    // @ts-expect-error test double
    globalThis.Audio = MockAudio;
  });
  afterAll(() => {
    globalThis.Audio = OriginalAudio;
  });

  it('click on the waveform area seeks proportionally', async () => {
    const el = makePlayer();
    el.src = 'episode.mp3'; // MockAudio.duration = 120
    await el.updateComplete;
    const area = el.shadowRoot!.querySelector<HTMLElement>('.waveform-area')!;
    Object.defineProperty(area, 'clientWidth', { value: 200, configurable: true });
    // 50% across a 200px area → 60s of a 120s track
    const ev = new MouseEvent('pointerdown', { clientX: 100, bubbles: true });
    Object.defineProperty(ev, 'offsetX', { value: 100 });
    area.dispatchEvent(ev);
    expect(el.audioElement!.currentTime).toBeCloseTo(60, 1);
  });
});

describe('DawPlayerElement — waveform', () => {
  let origClientWidthDescriptor: PropertyDescriptor | undefined;

  beforeAll(() => {
    // happy-dom has no layout engine; stub clientWidth so _timelineWidth > 0
    origClientWidthDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientWidth'
    );
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 500;
      },
    });
  });

  // Fix 2: re-establish the spy before every test — the outer afterEach calls
  // vi.restoreAllMocks(), which tears it down after the first test if set in beforeAll.
  beforeEach(() => {
    // happy-dom canvas has no 2D context; stub it so child <daw-waveform> and
    // <daw-ruler> draws are no-ops (ruler uses beginPath/moveTo/lineTo/stroke/fillText).
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      resetTransform: vi.fn(),
      scale: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 0 }),
      setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  afterAll(() => {
    if (origClientWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', origClientWidthDescriptor);
    } else {
      // Remove the override if original didn't exist
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (HTMLElement.prototype as unknown as Record<string, unknown>)['clientWidth'];
    }
  });

  function fakeWaveformData(channels: number) {
    // Minimal WaveformData-like stub matching what extractPeaks reads.
    return {
      bits: 16,
      channels,
      length: 100,
      scale: 256,
      sample_rate: 48000,
      duration: (100 * 256) / 48000,
      resample: () => fakeWaveformData(channels),
      channel: () => ({
        min_array: () => new Int16Array(50).fill(-10),
        max_array: () => new Int16Array(50).fill(10),
      }),
    };
  }

  it('renders one <daw-waveform> per channel when peaks-src loads', async () => {
    vi.spyOn(peaksLoader, 'loadWaveformDataFromUrl').mockResolvedValue(
      fakeWaveformData(2) as never
    );
    const el = makePlayer();
    el.src = 'episode.mp3';
    el.peaksSrc = 'episode.dat';
    await el.updateComplete;
    await vi.waitFor(() => {
      const waves = el.shadowRoot!.querySelectorAll('daw-waveform');
      expect(waves.length).toBe(2);
    });
  });

  it('mono attribute collapses to a single waveform', async () => {
    vi.spyOn(peaksLoader, 'loadWaveformDataFromUrl').mockResolvedValue(
      fakeWaveformData(2) as never
    );
    const el = makePlayer();
    el.mono = true;
    el.src = 'episode.mp3';
    el.peaksSrc = 'episode.dat';
    await el.updateComplete;
    await vi.waitFor(() => {
      expect(el.shadowRoot!.querySelectorAll('daw-waveform').length).toBe(1);
    });
  });

  it('renders no waveform (scrubber-only) when peaks-src is absent', async () => {
    const el = makePlayer();
    el.src = 'episode.mp3';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('daw-waveform').length).toBe(0);
  });

  it('falls back to scrubber-only when peaks-src fails to load', async () => {
    vi.spyOn(peaksLoader, 'loadWaveformDataFromUrl').mockRejectedValue(new Error('404'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = makePlayer();
    el.src = 'episode.mp3';
    el.peaksSrc = 'missing.dat';
    await el.updateComplete;
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    expect(el.shadowRoot!.querySelectorAll('daw-waveform').length).toBe(0);
  });

  it('renders a <daw-ruler> when timescale is set', async () => {
    const el = makePlayer();
    el.timescale = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('daw-ruler')).toBeTruthy();
  });

  it('changing wave-height does not recompute peaks (only updates display height)', async () => {
    vi.spyOn(peaksLoader, 'loadWaveformDataFromUrl').mockResolvedValue(
      fakeWaveformData(1) as never
    );
    const extractSpy = vi.spyOn(waveformDataUtils, 'extractPeaks');
    const el = makePlayer();
    el.src = 'episode.mp3';
    el.peaksSrc = 'episode.dat';
    el.waveHeight = 100;
    await el.updateComplete;
    await vi.waitFor(() => {
      expect(el.shadowRoot!.querySelectorAll('daw-waveform').length).toBe(1);
    });
    // Guard: confirm the spy actually intercepts the load-time extraction, else the
    // "not called again" assertion below would pass trivially and mean nothing.
    const callsAfterLoad = extractSpy.mock.calls.length;
    expect(callsAfterLoad).toBeGreaterThan(0);

    el.waveHeight = 64;
    await el.updateComplete;

    // wave-height only affects display height (render() reads it directly); it must
    // NOT recompute the fit-to-width peaks (a recompute sets @state mid-updated() →
    // a Lit change-in-update warning + wasted render).
    expect(extractSpy.mock.calls.length).toBe(callsAfterLoad);
    const wf = el.shadowRoot!.querySelector('daw-waveform') as HTMLElement & { waveHeight: number };
    expect(wf.waveHeight).toBe(64);
  });

  // Fix 1 regression tests: daw-ready must fire even when peaks-src fails or is absent
  describe('daw-ready readiness (peaks-settled gate)', () => {
    let OriginalAudio: typeof Audio;
    beforeAll(() => {
      OriginalAudio = globalThis.Audio;
      // @ts-expect-error test double
      globalThis.Audio = MockAudio;
    });
    afterAll(() => {
      globalThis.Audio = OriginalAudio;
    });

    it('fires daw-ready once when peaks-src fails to load (scrubber fallback)', async () => {
      vi.spyOn(peaksLoader, 'loadWaveformDataFromUrl').mockRejectedValue(new Error('404'));
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const el = makePlayer();
      el.src = 'episode.mp3';
      el.peaksSrc = 'missing.dat';
      await el.updateComplete;
      const ready = vi.fn();
      el.addEventListener('daw-ready', ready);
      // Wait for the async load to reject, then dispatch metadata
      await vi.waitFor(() => expect(console.warn).toHaveBeenCalled());
      el.audioElement!.dispatchEvent(new Event('loadedmetadata'));
      await vi.waitFor(() => expect(ready).toHaveBeenCalledTimes(1));
      // Scrubber-only — no waveform channel elements
      expect(el.shadowRoot!.querySelectorAll('daw-waveform').length).toBe(0);
    });

    it('fires daw-ready exactly once when peaks-src succeeds (no double-fire)', async () => {
      vi.spyOn(peaksLoader, 'loadWaveformDataFromUrl').mockResolvedValue(
        fakeWaveformData(2) as never
      );
      const el = makePlayer();
      el.src = 'episode.mp3';
      el.peaksSrc = 'episode.dat';
      await el.updateComplete;
      const ready = vi.fn();
      el.addEventListener('daw-ready', ready);
      // Wait for peaks to settle (waveforms rendered), then fire metadata
      await vi.waitFor(() =>
        expect(el.shadowRoot!.querySelectorAll('daw-waveform').length).toBe(2)
      );
      el.audioElement!.dispatchEvent(new Event('loadedmetadata'));
      expect(ready).toHaveBeenCalledTimes(1);
    });
  });
});
