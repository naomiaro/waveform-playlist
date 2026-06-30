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
  load = vi.fn();

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
