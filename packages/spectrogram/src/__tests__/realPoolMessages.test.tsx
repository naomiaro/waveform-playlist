// #821: what the provider costs the workers, on the REAL worker pool and
// client (`@dawcore/spectrogram`) with a fake Worker that records every
// message. A `compute-fft` for audio the worker does not hold carries a copy
// of the clip's whole audio; after a cleanup that keeps the component
// (<Activity>, StrictMode) the new pool must be given the audio so that no
// request carries it. Adopted from the review of #926: each case fails on the
// provider from before #821.
import React, { Activity, StrictMode } from 'react';
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import type { ClipTrack, AudioClip, SpectrogramCanvasRegistration } from '@waveform-playlist/core';

interface PostedMessage {
  type: string;
  id?: string;
  clipId?: string;
  offsetSamples?: number;
  channelDataArrays?: Float32Array[];
}

interface WorkerRecord {
  messages: PostedMessage[];
  terminated: boolean;
}

const fake = vi.hoisted(() => ({
  workers: [] as WorkerRecord[],
  timeline: { tracks: [] as unknown[], isReady: true },
  values: [] as Array<{
    registerSpectrogramCanvas: (reg: SpectrogramCanvasRegistration) => void;
    unregisterSpectrogramCanvas: (canvasId: string) => void;
  }>,
}));

/** Answers compute-fft and render-chunks the way the worker does. */
class RecordingWorker {
  private readonly record: WorkerRecord = { messages: [], terminated: false };
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: unknown = null;
  onmessageerror: unknown = null;

  constructor() {
    fake.workers.push(this.record);
  }

  postMessage(message: PostedMessage) {
    this.record.messages.push(message);
    if (this.record.terminated) return;
    const reply =
      message.type === 'compute-fft'
        ? { id: message.id, type: 'cache-key', cacheKey: `k${message.id}` }
        : message.type === 'render-chunks'
          ? { id: message.id, type: 'done' }
          : null;
    if (reply) queueMicrotask(() => this.onmessage?.({ data: reply } as MessageEvent));
  }

  terminate() {
    this.record.terminated = true;
  }
}

vi.mock('@waveform-playlist/browser', () => ({
  SpectrogramIntegrationProvider: ({
    value,
    children,
  }: {
    value: (typeof fake.values)[number];
    children: React.ReactNode;
  }) => {
    fake.values.push(value);
    return children;
  },
  usePlaybackControls: () => ({ scrollContainerRef: { current: null } }),
  usePlaylistView: () => ({ mono: false }),
  usePlaylistZoom: () => ({ samplesPerPixel: 100 }),
  usePlaylistTimeline: () => fake.timeline,
}));

import { SpectrogramProvider } from '../SpectrogramProvider';

const SAMPLE_RATE = 48000;

function stereoBuffer(): AudioBuffer {
  const channels = [new Float32Array(SAMPLE_RATE), new Float32Array(SAMPLE_RATE)];
  return {
    numberOfChannels: 2,
    sampleRate: SAMPLE_RATE,
    length: SAMPLE_RATE,
    getChannelData: (ch: number) => channels[ch],
  } as unknown as AudioBuffer;
}

function clip(id: string, audioBuffer: AudioBuffer, offsetSamples = 0): AudioClip {
  return {
    id,
    startSample: 0,
    offsetSamples,
    durationSamples: SAMPLE_RATE / 2,
    sampleRate: SAMPLE_RATE,
    audioBuffer,
  } as AudioClip;
}

function spectrogramTrack(clips: AudioClip[]): ClipTrack {
  return { id: 't1', name: 't1', kind: 'audio', renderMode: 'spectrogram', clips } as ClipTrack;
}

function canvas(clipId: string, channelIndex: number): SpectrogramCanvasRegistration {
  return {
    canvasId: `${clipId}-ch${channelIndex}-chunk0`,
    canvas: {} as OffscreenCanvas,
    clipId,
    channelIndex,
    chunkIndex: 0,
    widthPx: 240,
    heightPx: 80,
  };
}

const latest = () => fake.values[fake.values.length - 1];
const liveWorkers = () => fake.workers.filter((w) => !w.terminated);
const messagesOf = (workers: WorkerRecord[], type: string) =>
  workers.flatMap((w) => w.messages).filter((m) => m.type === type);
/** Bytes of audio carried inside compute-fft requests (0 when pre-registered). */
const fftAudioBytes = (workers: WorkerRecord[]) =>
  messagesOf(workers, 'compute-fft').reduce(
    (sum, m) => sum + (m.channelDataArrays ?? []).reduce((n, a) => n + a.byteLength, 0),
    0
  );

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });

async function registerStereoCanvases(clipId: string) {
  await act(async () => {
    latest().registerSpectrogramCanvas(canvas(clipId, 0));
    latest().registerSpectrogramCanvas(canvas(clipId, 1));
  });
  await settle();
}

beforeAll(() => vi.stubGlobal('Worker', RecordingWorker));
afterAll(() => vi.unstubAllGlobals());
afterEach(() => {
  cleanup();
  fake.workers = [];
  fake.values = [];
});

describe('SpectrogramProvider on the real worker pool (#821)', () => {
  it('after an <Activity> hide and reveal, no FFT request carries the audio', async () => {
    fake.timeline = { tracks: [spectrogramTrack([clip('c1', stereoBuffer())])], isReady: true };
    const tree = (mode: 'visible' | 'hidden') => (
      <Activity mode={mode}>
        <SpectrogramProvider>
          <div />
        </SpectrogramProvider>
      </Activity>
    );
    const view = render(tree('visible'));
    await settle();
    await registerStereoCanvases('c1');
    view.rerender(tree('hidden'));
    await settle();
    view.rerender(tree('visible'));
    await settle();
    // The channel's cleanup released its canvases; fresh ones register (#856).
    await registerStereoCanvases('c1');

    const live = liveWorkers();
    expect(messagesOf(live, 'register-audio-data')).toHaveLength(2);
    expect(messagesOf(live, 'compute-fft').length).toBeGreaterThan(0);
    expect(fftAudioBytes(live)).toBe(0);
  });

  it('under StrictMode no FFT request carries the audio', async () => {
    fake.timeline = { tracks: [spectrogramTrack([clip('c1', stereoBuffer())])], isReady: true };
    render(
      <StrictMode>
        <SpectrogramProvider>
          <div />
        </SpectrogramProvider>
      </StrictMode>
    );
    await settle();
    await registerStereoCanvases('c1');

    const live = liveWorkers();
    expect(messagesOf(live, 'compute-fft').length).toBeGreaterThan(0);
    expect(fftAudioBytes(live)).toBe(0);
  });

  it('while the playlist is still loading, a loaded spectrogram track draws without copying its audio', async () => {
    // isReady is false until an engine is attached and no source is pending
    // (the first time); a track whose audio is decoded draws meanwhile
    // (review of #926).
    fake.timeline = {
      tracks: [spectrogramTrack([clip('c1', stereoBuffer())])],
      isReady: false,
    };
    render(
      <SpectrogramProvider>
        <div />
      </SpectrogramProvider>
    );
    await settle();
    await registerStereoCanvases('c1');

    expect(messagesOf(fake.workers, 'register-audio-data')).toHaveLength(2);
    expect(messagesOf(fake.workers, 'compute-fft').length).toBeGreaterThan(0);
    expect(fftAudioBytes(fake.workers)).toBe(0);
  });

  it('two clips on one buffer register it once, and each FFT request keeps its own range', async () => {
    const buffer = stereoBuffer();
    fake.timeline = {
      tracks: [spectrogramTrack([clip('c1', buffer, 0), clip('c2', buffer, SAMPLE_RATE / 2)])],
      isReady: true,
    };
    render(
      <SpectrogramProvider>
        <div />
      </SpectrogramProvider>
    );
    await settle();
    await registerStereoCanvases('c1');
    await registerStereoCanvases('c2');

    // One registration per worker (a stereo clip reaches both).
    expect(messagesOf(fake.workers, 'register-audio-data')).toHaveLength(2);
    const ffts = messagesOf(fake.workers, 'compute-fft');
    expect(new Set(ffts.map((m) => m.clipId)).size).toBe(1);
    expect(new Set(ffts.map((m) => m.offsetSamples))).toEqual(new Set([0, SAMPLE_RATE / 2]));
    expect(fftAudioBytes(fake.workers)).toBe(0);
  });
});
