import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MediaElementTrack } from '../src/MediaElementTrack';

/**
 * Minimal MockAudioElement harness — same pattern as player-mode.test.ts.
 * Registered as globalThis.Audio so `new Audio(url)` returns a mock,
 * exercising the owns-element string-source construction path.
 */
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
  play = () => Promise.resolve();
  pause = () => {};
  load = () => {
    this.playbackRate = 1;
  };

  constructor(src = '') {
    super();
    this.src = src;
  }
}

beforeEach(() => {
  (globalThis as unknown as { Audio: unknown }).Audio = MockAudioElement;
});

afterEach(() => {
  delete (globalThis as unknown as { Audio?: unknown }).Audio;
});

describe('setPlaybackRate clamp (0.25–4.0)', () => {
  it('allows rates down to 0.25', () => {
    const track = new MediaElementTrack({ source: 'test.mp3' });
    track.setPlaybackRate(0.25);
    expect(track.playbackRate).toBe(0.25);
  });

  it('allows rates up to 4.0', () => {
    const track = new MediaElementTrack({ source: 'test.mp3' });
    track.setPlaybackRate(4.0);
    expect(track.playbackRate).toBe(4.0);
  });

  it('clamps below 0.25 up to 0.25 and above 4.0 down to 4.0', () => {
    const track = new MediaElementTrack({ source: 'test.mp3' });
    track.setPlaybackRate(0.1);
    expect(track.playbackRate).toBe(0.25);
    track.setPlaybackRate(8);
    expect(track.playbackRate).toBe(4.0);
  });
});
