import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WaveformDataObject } from '@waveform-playlist/core';
import { MediaElementPlayout } from '../src/MediaElementPlayout';
import { MediaElementTrack } from '../src/MediaElementTrack';

/**
 * Controllable stand-in for HTMLAudioElement, built on the global `EventTarget`
 * so native media events ('play' / 'pause' / 'loadedmetadata' / 'error' /
 * 'ended' / 'timeupdate') dispatch for real with no DOM environment.
 *
 * Registering it as `globalThis.Audio` makes `new Audio(url)` (the string-source
 * construction path) return a mock, so tracks are created with `ownsElement = true`
 * — required to exercise the in-place `load()` swap.
 */
let created: MockAudioElement[] = [];

class MockAudioElement extends EventTarget {
  preload = '';
  playbackRate = 1;
  volume = 1;
  muted = false;
  paused = true;
  ended = false;
  currentTime = 0;
  duration = NaN;
  preservesPitch = true;
  src: string;
  error: MediaError | null = null;
  play = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  load = vi.fn(() => {
    // Model the HTML load algorithm resetting playbackRate to defaultPlaybackRate (1.0).
    this.playbackRate = 1;
  });

  constructor(src = '') {
    super();
    this.src = src;
    created.push(this);
  }
}

beforeEach(() => {
  created = [];
  (globalThis as unknown as { Audio: unknown }).Audio = MockAudioElement;
});

afterEach(() => {
  delete (globalThis as unknown as { Audio?: unknown }).Audio;
});

describe('resume()', () => {
  it('resumes from the current position without resetting currentTime', () => {
    const playout = new MediaElementPlayout();
    playout.addTrack({ source: 'a.mp3' });
    const el = created[0];

    el.currentTime = 30; // simulate having played to 30s, then paused
    playout.resume();

    expect(el.play).toHaveBeenCalled();
    expect(el.currentTime).toBe(30);
  });

  it('plain play() with no offset still resets to 0 (unchanged behavior)', () => {
    const playout = new MediaElementPlayout();
    playout.addTrack({ source: 'a.mp3' });
    const el = created[0];

    el.currentTime = 30;
    playout.play();

    expect(el.currentTime).toBe(0);
  });
});

describe('MediaElementTrack lifecycle event emitter', () => {
  it('emits loadedmetadata / play / pause on dispatched native events', () => {
    const playout = new MediaElementPlayout();
    const track = playout.addTrack({ source: 'a.mp3' });
    const el = created[0];

    const onLoaded = vi.fn();
    const onPlay = vi.fn();
    const onPause = vi.fn();
    track.on('loadedmetadata', onLoaded);
    track.on('play', onPlay);
    track.on('pause', onPause);

    el.dispatchEvent(new Event('loadedmetadata'));
    el.dispatchEvent(new Event('play'));
    el.dispatchEvent(new Event('pause'));

    expect(onLoaded).toHaveBeenCalledTimes(1);
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('emits error with the element MediaError', () => {
    const playout = new MediaElementPlayout();
    const track = playout.addTrack({ source: 'a.mp3' });
    const el = created[0];
    const mediaError = { code: 4, message: 'unsupported' } as unknown as MediaError;
    el.error = mediaError;

    const onError = vi.fn();
    track.on('error', onError);
    el.dispatchEvent(new Event('error'));

    expect(onError).toHaveBeenCalledWith(mediaError);
  });

  it('off() removes a listener', () => {
    const playout = new MediaElementPlayout();
    const track = playout.addTrack({ source: 'a.mp3' });
    const el = created[0];

    const onPlay = vi.fn();
    track.on('play', onPlay);
    track.off('play', onPlay);
    el.dispatchEvent(new Event('play'));

    expect(onPlay).not.toHaveBeenCalled();
  });

  it('a throwing listener does not break sibling listeners', () => {
    const playout = new MediaElementPlayout();
    const track = playout.addTrack({ source: 'a.mp3' });
    const el = created[0];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const thrower = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    track.on('play', thrower);
    track.on('play', good);
    el.dispatchEvent(new Event('play'));

    expect(good).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('emits ended and timeupdate alongside the legacy callbacks', () => {
    const playout = new MediaElementPlayout();
    const track = playout.addTrack({ source: 'a.mp3' });
    const el = created[0];

    const onEnded = vi.fn();
    const onTime = vi.fn();
    const legacyStop = vi.fn();
    const legacyTime = vi.fn();
    track.on('ended', onEnded);
    track.on('timeupdate', onTime);
    track.setOnStopCallback(legacyStop);
    track.setOnTimeUpdateCallback(legacyTime);

    el.currentTime = 5;
    el.dispatchEvent(new Event('timeupdate'));
    el.dispatchEvent(new Event('ended'));

    expect(onTime).toHaveBeenCalledWith(5);
    expect(legacyTime).toHaveBeenCalledWith(5);
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(legacyStop).toHaveBeenCalledTimes(1);
  });
});

describe('MediaElementPlayout event forwarding', () => {
  it('forwards play events from the current track', () => {
    const playout = new MediaElementPlayout();
    playout.addTrack({ source: 'a.mp3' });
    const el = created[0];

    const onPlay = vi.fn();
    playout.on('play', onPlay);
    el.dispatchEvent(new Event('play'));

    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('listeners registered before any track re-attach to the first track', () => {
    const playout = new MediaElementPlayout();
    const onLoaded = vi.fn();
    playout.on('loadedmetadata', onLoaded); // no track yet

    playout.addTrack({ source: 'a.mp3' });
    created[0].dispatchEvent(new Event('loadedmetadata'));

    expect(onLoaded).toHaveBeenCalledTimes(1);
  });

  it('off() stops forwarding', () => {
    const playout = new MediaElementPlayout();
    playout.addTrack({ source: 'a.mp3' });
    const el = created[0];

    const onPause = vi.fn();
    playout.on('pause', onPause);
    playout.off('pause', onPause);
    el.dispatchEvent(new Event('pause'));

    expect(onPause).not.toHaveBeenCalled();
  });

  it('listeners survive track replacement (addTrack called twice)', () => {
    const playout = new MediaElementPlayout();
    playout.addTrack({ source: 'a.mp3' });
    const onPlay = vi.fn();
    playout.on('play', onPlay);

    playout.addTrack({ source: 'b.mp3' }); // replace: old track disposed, new created
    const newEl = created[1];
    newEl.dispatchEvent(new Event('play'));

    expect(onPlay).toHaveBeenCalledTimes(1);
  });
});

function makePeaks(overrides: Partial<WaveformDataObject> = {}): WaveformDataObject {
  return { sample_rate: 44100, duration: 0, ...overrides } as WaveformDataObject;
}

describe('setSource() / in-place source swap', () => {
  it('replaces the source in place without warning and reuses the same element', () => {
    const playout = new MediaElementPlayout();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const first = playout.setSource({ source: 'a.mp3' });
    expect(created).toHaveLength(1);
    expect(created[0].src).toBe('a.mp3');

    const second = playout.setSource({ source: 'b.mp3' });

    expect(second).toBe(first); // same track instance — in-place reuse
    expect(created).toHaveLength(1); // no new element created
    expect(created[0].src).toBe('b.mp3'); // src swapped
    expect(created[0].load).toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('updates peaks (replace) and name (when provided) on swap', () => {
    const playout = new MediaElementPlayout();
    const track = playout.setSource({ source: 'a.mp3', peaks: makePeaks({ duration: 10 }) });

    playout.setSource({ source: 'b.mp3', name: 'Show 2' });
    expect(track.peaks).toBeNull(); // peaks not provided for b.mp3 → cleared
    expect(track.name).toBe('Show 2');
  });

  it('keeps consumer listeners working across an in-place swap', () => {
    const playout = new MediaElementPlayout();
    const onLoaded = vi.fn();
    playout.on('loadedmetadata', onLoaded);

    playout.setSource({ source: 'a.mp3' });
    created[0].dispatchEvent(new Event('loadedmetadata'));
    playout.setSource({ source: 'b.mp3' }); // in-place, same element
    created[0].dispatchEvent(new Event('loadedmetadata'));

    expect(onLoaded).toHaveBeenCalledTimes(2);
  });

  it('addTrack() still warns when replacing an existing track', () => {
    const playout = new MediaElementPlayout();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    playout.addTrack({ source: 'a.mp3' });
    playout.addTrack({ source: 'b.mp3' }); // replace via addTrack → warns

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Only one track is supported'));
    warnSpy.mockRestore();
  });

  it('track.load() warns and no-ops for a borrowed element', () => {
    const borrowed = new MockAudioElement('borrowed.mp3');
    const track = new MediaElementTrack({ source: borrowed as unknown as HTMLAudioElement });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    track.load('new.mp3');

    expect(borrowed.src).toBe('borrowed.mp3'); // unchanged
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('own their audio element'));
    warnSpy.mockRestore();
  });

  it('preserves the configured playback rate across an in-place source swap', () => {
    const playout = new MediaElementPlayout({ playbackRate: 1.5 });
    playout.addTrack({ source: 'a.mp3' });
    const el = created[0];
    expect(el.playbackRate).toBe(1.5); // set on construction

    playout.setSource({ source: 'b.mp3' }); // in-place: browser resets rate, load() must re-apply
    expect(el.playbackRate).toBe(1.5);
    expect(playout.playbackRate).toBe(1.5);
  });

  it('setSource() clears isPlaying (a swap stops current playback)', () => {
    const playout = new MediaElementPlayout();
    playout.addTrack({ source: 'a.mp3' });
    playout.play(undefined, 0);
    expect(playout.isPlaying).toBe(true);

    playout.setSource({ source: 'b.mp3' });
    expect(playout.isPlaying).toBe(false);
  });
});

describe('a play() the browser does not start', () => {
  const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

  it("emits 'playrejected' and is no longer playing when the element refuses", async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const playout = new MediaElementPlayout();
    playout.addTrack({ source: 'a.mp3' });
    const refused = Object.assign(new Error('no user gesture'), { name: 'NotAllowedError' });
    created[0].play.mockImplementation(() => Promise.reject(refused));
    const onRejected = vi.fn();
    playout.on('playrejected', onRejected);

    playout.play(undefined, 2);
    expect(playout.isPlaying).toBe(true);
    await flush();

    expect(onRejected).toHaveBeenCalledExactlyOnceWith(refused);
    expect(playout.isPlaying).toBe(false);
    vi.restoreAllMocks();
  });

  it('says nothing when the play was only interrupted (AbortError)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const playout = new MediaElementPlayout();
    playout.addTrack({ source: 'a.mp3' });
    // What a browser rejects with: a DOMException.
    const aborted = new DOMException('interrupted by pause', 'AbortError');
    created[0].play.mockImplementation(() => Promise.reject(aborted));
    const onRejected = vi.fn();
    playout.on('playrejected', onRejected);

    playout.play(undefined, 2);
    await flush();

    expect(onRejected).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(playout.isPlaying).toBe(true);
    vi.restoreAllMocks();
  });
});

describe('a start that waits for a suspended AudioContext', () => {
  // The smallest AudioContext the track needs: nodes that connect, and a
  // resume() the test settles by hand.
  function createSuspendedContext() {
    const node = () => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
        setValueCurveAtTime: vi.fn(),
      },
    });
    let settle: { resolve: () => void; reject: (reason: unknown) => void } | null = null;
    const context = {
      state: 'suspended',
      currentTime: 0,
      destination: {},
      createMediaElementSource: vi.fn(node),
      createGain: vi.fn(node),
      resume: vi.fn(
        () =>
          new Promise<void>((resolve, reject) => {
            settle = { resolve, reject };
          })
      ),
    };
    return {
      context: context as unknown as AudioContext,
      resumed: async () => {
        context.state = 'running';
        settle?.resolve();
        await Promise.resolve();
        await Promise.resolve();
      },
      refused: async (reason: unknown) => {
        settle?.reject(reason);
        await Promise.resolve();
        await Promise.resolve();
      },
    };
  }

  it('starts the element once the context has resumed', async () => {
    const { context, resumed } = createSuspendedContext();
    const playout = new MediaElementPlayout();
    playout.addTrack({ source: 'a.mp3', audioContext: context });

    playout.play(undefined, 2);
    expect(created[0].play).not.toHaveBeenCalled();
    await resumed();
    expect(created[0].play).toHaveBeenCalledTimes(1);
    expect(created[0].currentTime).toBe(2);
  });

  it.each(['pause', 'stop'] as const)(
    'does not start after a %s() that came while it waited',
    async (action) => {
      const { context, resumed } = createSuspendedContext();
      const playout = new MediaElementPlayout();
      playout.addTrack({ source: 'a.mp3', audioContext: context });

      playout.play(undefined, 2);
      playout[action]();
      await resumed();

      expect(created[0].play).not.toHaveBeenCalled();
    }
  );

  it('a newer play() replaces the one that was waiting', async () => {
    const { context, resumed } = createSuspendedContext();
    const playout = new MediaElementPlayout();
    playout.addTrack({ source: 'a.mp3', audioContext: context });

    playout.play(undefined, 2);
    playout.play(undefined, 5);
    await resumed();

    expect(created[0].play).toHaveBeenCalledTimes(1);
    expect(created[0].currentTime).toBe(5);
  });

  it("emits 'playrejected' when resume() rejects, unless the play was cancelled first", async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const first = createSuspendedContext();
    const playout = new MediaElementPlayout();
    playout.addTrack({ source: 'a.mp3', audioContext: first.context });
    const onRejected = vi.fn();
    playout.on('playrejected', onRejected);

    playout.play(undefined, 2);
    await first.refused(new Error('not allowed'));
    expect(onRejected).toHaveBeenCalledTimes(1);
    expect(playout.isPlaying).toBe(false);

    playout.play(undefined, 2);
    playout.pause();
    await first.refused(new Error('not allowed'));
    expect(onRejected).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});
