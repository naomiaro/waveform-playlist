import { describe, it, expect, vi } from 'vitest';
import type { WaveformDataObject } from '@waveform-playlist/core';
import { MediaElementTrack } from '../src/MediaElementTrack';
import { MediaElementPlayout } from '../src/MediaElementPlayout';

/**
 * Minimal controllable stand-in for HTMLAudioElement.
 *
 * Built on the global `EventTarget` so `'ended'` / `'timeupdate'` dispatch for
 * real — no DOM environment (jsdom/happy-dom) required. `MediaElementTrack`
 * accepts an `HTMLAudioElement` as its `source`, so injecting this mock drives
 * every code path deterministically.
 */
class MockAudioElement extends EventTarget {
  preload = '';
  playbackRate = 1;
  volume = 1;
  muted = false;
  paused = true;
  ended = false;
  currentTime = 0;
  /** HTMLMediaElement reports NaN until metadata loads. */
  duration = NaN;
  preservesPitch = true;
  src = '';
  play = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  load = vi.fn();
}

function asAudioElement(mock: MockAudioElement): HTMLAudioElement {
  return mock as unknown as HTMLAudioElement;
}

/** A partial peaks object — production only reads `duration` / `sample_rate`. */
function makePeaks(overrides: Partial<WaveformDataObject> = {}): WaveformDataObject {
  return { sample_rate: 44100, duration: 0, ...overrides } as WaveformDataObject;
}

describe('MediaElementTrack with peaks omitted', () => {
  it('constructs without throwing and exposes peaks as null', () => {
    const el = new MockAudioElement();
    const track = new MediaElementTrack({ source: asAudioElement(el) });
    expect(track.peaks).toBeNull();
  });

  it('duration returns the audio element duration when available', () => {
    const el = new MockAudioElement();
    el.duration = 123;
    const track = new MediaElementTrack({ source: asAudioElement(el) });
    expect(track.duration).toBe(123);
  });

  it('duration falls back to 0 (no throw) when the element duration is unavailable', () => {
    const el = new MockAudioElement(); // duration === NaN
    const track = new MediaElementTrack({ source: asAudioElement(el) });
    expect(() => track.duration).not.toThrow();
    expect(track.duration).toBe(0);
  });

  it('play() and pause() operate', () => {
    const el = new MockAudioElement();
    const track = new MediaElementTrack({ source: asAudioElement(el) });
    track.play(0);
    expect(el.play).toHaveBeenCalled();
    expect(el.paused).toBe(false);
    track.pause();
    expect(el.pause).toHaveBeenCalled();
    expect(el.paused).toBe(true);
  });

  it('seekTo() clamps without throwing when the element duration is unavailable', () => {
    const el = new MockAudioElement(); // duration === NaN
    const track = new MediaElementTrack({ source: asAudioElement(el) });
    expect(() => track.seekTo(30)).not.toThrow();
    expect(el.currentTime).toBe(0);
  });

  it('seekTo() seeks within a known element duration', () => {
    const el = new MockAudioElement();
    el.duration = 100;
    const track = new MediaElementTrack({ source: asAudioElement(el) });
    track.seekTo(30);
    expect(el.currentTime).toBe(30);
  });

  it('setPlaybackRate() updates the element', () => {
    const el = new MockAudioElement();
    const track = new MediaElementTrack({ source: asAudioElement(el) });
    track.setPlaybackRate(1.5);
    expect(el.playbackRate).toBe(1.5);
    expect(track.playbackRate).toBe(1.5);
  });

  it('forwards timeupdate and ended events', () => {
    const el = new MockAudioElement();
    const track = new MediaElementTrack({ source: asAudioElement(el) });
    const onTime = vi.fn();
    const onStop = vi.fn();
    track.setOnTimeUpdateCallback(onTime);
    track.setOnStopCallback(onStop);

    el.currentTime = 12.5;
    el.dispatchEvent(new Event('timeupdate'));
    expect(onTime).toHaveBeenCalledWith(12.5);

    el.dispatchEvent(new Event('ended'));
    expect(onStop).toHaveBeenCalled();
  });
});

describe('MediaElementPlayout with peaks omitted', () => {
  it('addTrack() works and sampleRate returns the 44100 default', () => {
    const playout = new MediaElementPlayout();
    const el = new MockAudioElement();
    playout.addTrack({ source: asAudioElement(el) });
    expect(() => playout.sampleRate).not.toThrow();
    expect(playout.sampleRate).toBe(44100);
  });

  it('play()/pause()/seekTo() drive the underlying track', () => {
    const playout = new MediaElementPlayout();
    const el = new MockAudioElement();
    el.duration = 60;
    playout.addTrack({ source: asAudioElement(el) });

    playout.play(undefined, 0);
    expect(el.play).toHaveBeenCalled();

    playout.seekTo(10);
    expect(el.currentTime).toBe(10);

    playout.pause();
    expect(el.pause).toHaveBeenCalled();
  });
});

describe('MediaElementTrack with peaks provided (backward compatibility)', () => {
  it('exposes the provided peaks object', () => {
    const el = new MockAudioElement();
    const peaks = makePeaks({ duration: 200, sample_rate: 48000 });
    const track = new MediaElementTrack({ source: asAudioElement(el), peaks });
    expect(track.peaks).toBe(peaks);
  });

  it('duration falls back to peaks.duration when the element duration is unavailable', () => {
    const el = new MockAudioElement(); // duration === NaN
    const peaks = makePeaks({ duration: 200 });
    const track = new MediaElementTrack({ source: asAudioElement(el), peaks });
    expect(track.duration).toBe(200);
  });

  it('MediaElementPlayout.sampleRate reflects the provided peaks sample_rate', () => {
    const playout = new MediaElementPlayout();
    const el = new MockAudioElement();
    playout.addTrack({ source: asAudioElement(el), peaks: makePeaks({ sample_rate: 48000 }) });
    expect(playout.sampleRate).toBe(48000);
  });
});
