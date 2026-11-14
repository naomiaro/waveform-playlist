// @vitest-environment jsdom
//
// #812: export leaves a placeholder (a clip drawn while its audio loads, with
// `src` and no buffer) out without a warning, and out of the export length. A
// clip the app made itself without a buffer (peaks only, no `src`) keeps the
// warning it had.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { AudioClip, ClipTrack } from '@waveform-playlist/core';

const state = vi.hoisted(() => ({
  /** One entry per Player created: the buffer it plays. */
  playedBuffers: [] as unknown[],
  /** The duration renderToneOffline was asked for, in seconds. */
  duration: -1,
}));

vi.mock('tone', () => {
  class Node {
    connect() {
      return this;
    }
  }
  class Gain extends Node {
    input = { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} } };
  }
  class Volume extends Node {}
  class ToneAudioBuffer {
    constructor(public buffer: unknown) {}
  }
  class Player extends Node {
    constructor(toneBuffer: ToneAudioBuffer) {
      super();
      state.playedBuffers.push(toneBuffer.buffer);
    }
    start() {}
  }
  return { Gain, Volume, ToneAudioBuffer, Player, connect: () => {} };
});

vi.mock('@waveform-playlist/playout', () => ({
  getGlobalAudioContext: () => ({ sampleRate: 48000 }),
}));

vi.mock('@waveform-playlist/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@waveform-playlist/core')>();
  return {
    ...actual,
    createPanStage: () => ({ input: {}, output: {} }),
    applyFadeIn: () => {},
    applyFadeOut: () => {},
  };
});

vi.mock('../utils/renderToneOffline', () => ({
  renderToneOffline: async (
    build: (context: unknown) => Promise<void> | void,
    duration: number
  ) => {
    state.duration = duration;
    await build({ destination: {}, rawContext: {}, transport: { start() {} } });
    return { length: 1, numberOfChannels: 1, sampleRate: 48000 };
  },
}));

vi.mock('../utils/wavEncoder', () => ({
  encodeWav: () => new Blob(),
  downloadBlob: () => {},
}));

import { useExportWav } from '../hooks/useExportWav';

const RATE = 48000;
const buffer = {
  numberOfChannels: 1,
  sampleRate: RATE,
  length: RATE * 2,
} as unknown as AudioBuffer;

function clip(id: string, over: Partial<AudioClip> = {}): AudioClip {
  return {
    id,
    name: id,
    startSample: 0,
    durationSamples: RATE * 2,
    offsetSamples: 0,
    sampleRate: RATE,
    sourceDurationSamples: RATE * 2,
    gain: 1,
    ...over,
  } as AudioClip;
}

/** What the provider draws for a clip whose source is pending: `src`, no buffer. */
function placeholder(id: string, startSeconds: number): AudioClip {
  return clip(id, { src: `/${id}.mp3`, startSample: RATE * startSeconds });
}

function track(id: string, clips: AudioClip[]): ClipTrack {
  return { id, name: id, clips, muted: false, soloed: false, volume: 1, pan: 0 } as ClipTrack;
}

async function exportTracks(tracks: ClipTrack[]) {
  const { result } = renderHook(() => useExportWav());
  await act(async () => {
    await result.current.exportWav(tracks, [], { autoDownload: false });
  });
}

beforeEach(() => {
  state.playedBuffers.length = 0;
  state.duration = -1;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('export and placeholders', () => {
  it('renders the loaded clip only, with no warning for the placeholder, and its length only', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await exportTracks([
      track('t1', [clip('real', { audioBuffer: buffer, src: '/real.mp3' }), placeholder('ph', 5)]),
    ]);
    expect(state.playedBuffers).toEqual([buffer]);
    expect(warn).not.toHaveBeenCalled();
    // 2 s of audio plus the 0.1 s tail; the placeholder at 5-7 s does not count.
    expect(state.duration).toBeCloseTo(2.1, 5);
  });

  it('exports a track of placeholders only as an empty track: silence, no warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await exportTracks([track('t1', [placeholder('a', 0), placeholder('b', 3)])]);
    expect(state.playedBuffers).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
    expect(state.duration).toBeCloseTo(0.1, 5);

    // The same length as a track with no clips at all.
    const emptyDuration = state.duration;
    await exportTracks([track('t1', [])]);
    expect(state.duration).toBe(emptyDuration);
  });

  it('still warns for a peaks-only clip the app made itself (no src)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await exportTracks([track('t1', [clip('peaks-only')])]);
    expect(state.playedBuffers).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('no audioBuffer for export');
    expect(state.duration).toBeCloseTo(2.1, 5);
  });
});
