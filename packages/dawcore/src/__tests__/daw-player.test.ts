import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import type { DawPlayerElement } from '../elements/daw-player';

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
});
