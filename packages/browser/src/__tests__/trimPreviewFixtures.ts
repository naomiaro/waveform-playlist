// The fixtures of the trim preview tests (#812): a provider's tracks with
// peaks, a fake adapter, and the dnd-kit events of a trim and a move of clip
// `b` (track 0, clip 1).
import WaveformData from 'waveform-data';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

export const SAMPLE_RATE = 48000;
export const SPP = 1000;

export function makeWaveformData(seconds: number): WaveformData {
  const bins = Math.ceil((seconds * SAMPLE_RATE) / 256);
  const data: number[] = [];
  // Values that differ along the file, so two slices of it differ.
  for (let i = 0; i < bins; i++) data.push(-(i % 97), (i * 7) % 113);
  return WaveformData.create({
    version: 2,
    channels: 1,
    sample_rate: SAMPLE_RATE,
    samples_per_pixel: 256,
    bits: 16,
    length: bins,
    data,
  });
}

export const SOURCE_SECONDS = 30;
export const WAVEFORM = makeWaveformData(SOURCE_SECONDS);

export function makeClip(
  id: string,
  startSeconds: number,
  seconds: number,
  offsetSeconds = 1
): AudioClip {
  return {
    id,
    name: id,
    startSample: startSeconds * SAMPLE_RATE,
    durationSamples: seconds * SAMPLE_RATE,
    offsetSamples: offsetSeconds * SAMPLE_RATE,
    sampleRate: SAMPLE_RATE,
    sourceDurationSamples: SOURCE_SECONDS * SAMPLE_RATE,
    gain: 1,
    waveformData: WAVEFORM,
  } as AudioClip;
}

export function makeTrack(id: string, clips: AudioClip[]): ClipTrack {
  return {
    id,
    name: id,
    kind: 'audio',
    clips,
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  } as ClipTrack;
}

// t1: a (0..1 s), b (2..3 s, from 1 s into its file). t2: c (0..1 s).
// The timeline ends at 3 s, with b.
export function initialTracks(): ClipTrack[] {
  return [
    makeTrack('t1', [makeClip('a', 0, 1), makeClip('b', 2, 1)]),
    makeTrack('t2', [makeClip('c', 0, 1)]),
  ];
}

export function createFakeAdapter(): PlayoutAdapter {
  return {
    audioContext: {
      currentTime: 0,
      sampleRate: SAMPLE_RATE,
      state: 'running',
      outputLatency: 0,
    } as unknown as AudioContext,
    ppqn: 960,
    async init() {},
    setTracks() {},
    addTrack() {},
    removeTrack() {},
    updateTrack() {},
    play() {},
    pause() {},
    stop() {},
    seek() {},
    getCurrentTime: () => 0,
    isPlaying: () => false,
    setMasterVolume() {},
    setTrackVolume() {},
    setTrackMute() {},
    setTrackSolo() {},
    setTrackPan() {},
    setLoop() {},
    dispose() {},
  } as unknown as PlayoutAdapter;
}

export function singleAdapter(): () => PlayoutAdapter {
  const adapter = createFakeAdapter();
  return () => adapter;
}

/** The first build gets an adapter; every later one waits for good (no engine). */
export function firstBuildOnly(): () => PlayoutAdapter {
  let built = false;
  return () => {
    if (built) return new Promise<never>(() => {}) as unknown as PlayoutAdapter;
    built = true;
    return createFakeAdapter();
  };
}

export type Boundary = 'left' | 'right';

/** A dnd-kit event for a boundary of clip `b` (track 0, clip 1), dragged by `dx` pixels. */
export function trimEvent(
  dx: number,
  boundary: Boundary = 'left',
  extra: Record<string, unknown> = {}
) {
  return {
    canceled: false,
    to: { x: 100 + dx, y: 0 },
    operation: {
      source: { data: { clipId: 'b', trackIndex: 0, clipIndex: 1, boundary } },
      position: { initial: { x: 100, y: 0 }, current: { x: 100, y: 0 } },
      transform: { x: dx, y: 0 },
    },
    ...extra,
  } as never;
}

export function moveEvent(dx: number, extra: { canceled?: boolean; trackIndex?: number } = {}) {
  return {
    canceled: extra.canceled ?? false,
    to: { x: 100 + dx, y: 0 },
    operation: {
      source: { data: { clipId: 'b', trackIndex: extra.trackIndex ?? 0, clipIndex: 1 } },
      position: { initial: { x: 100, y: 0 }, current: { x: 100, y: 0 } },
      transform: { x: dx, y: 0 },
    },
  } as never;
}
