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
