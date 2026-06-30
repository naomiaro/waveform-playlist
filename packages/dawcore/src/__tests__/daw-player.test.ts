import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import type { DawPlayerElement } from '../elements/daw-player';
import * as peaksLoader from '../interactions/peaks-loader';

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

    // happy-dom canvas has no 2D context; stub it so child <daw-waveform> draws are no-ops
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      resetTransform: vi.fn(),
      scale: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
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
});
