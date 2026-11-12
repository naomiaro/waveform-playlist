// @vitest-environment jsdom
//
// #695: the live recording preview. `recordingState.progress` is a source that
// publishes the take's elapsed time and peaks once per animation frame. Only
// the preview clip may render at that rate: the track rows, the other clips
// and the control panels must not, including once the take has run past the
// end of the displayed timeline (the timeline then grows in steps).
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import WaveformData from 'waveform-data';

const counts = vi.hoisted(() => ({
  clip: {} as Record<string, number>,
  clipDuration: {} as Record<string, number>,
  channel: 0,
  track: {} as Record<string, number>,
  trackWidth: {} as Record<string, number>,
  trackChannels: {} as Record<string, number>,
  controls: 0,
}));

vi.mock('@waveform-playlist/ui-components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@waveform-playlist/ui-components')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    Clip: (props: React.ComponentProps<typeof actual.Clip>) => {
      counts.clip[props.clipId] = (counts.clip[props.clipId] ?? 0) + 1;
      counts.clipDuration[props.clipId] = props.durationSamples;
      return createElement(actual.Clip, props);
    },
    SmartChannel: (props: React.ComponentProps<typeof actual.SmartChannel>) => {
      counts.channel++;
      return createElement(actual.SmartChannel, props);
    },
    Track: (props: React.ComponentProps<typeof actual.Track>) => {
      const id = props.trackId ?? '?';
      counts.track[id] = (counts.track[id] ?? 0) + 1;
      counts.trackWidth[id] = props.width ?? 0;
      counts.trackChannels[id] = props.numChannels;
      return createElement(actual.Track, props);
    },
    Controls: (props: React.ComponentProps<typeof actual.Controls>) => {
      counts.controls++;
      return createElement(actual.Controls, props);
    },
  };
});

import { WaveformPlaylistProvider, usePlaylistTimeline } from '../WaveformPlaylistContext';
import { PlaylistVisualization } from '../components/PlaylistVisualization';
import { recordingDisplayEnd } from '../hooks/useRecordingLayout';
import {
  createValueSource,
  type ClipTrack,
  type AudioClip,
  type RecordingProgress,
} from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;
const SAMPLES_PER_PIXEL = 1024;

function makeWaveformData(bins: number): WaveformData {
  const data: number[] = [];
  for (let i = 0; i < bins; i++) {
    data.push(-(i % 100), i % 100);
  }
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

function makeClip(id: string): AudioClip {
  return {
    id,
    startSample: 0,
    durationSamples: SAMPLE_RATE,
    offsetSamples: 0,
    sampleRate: SAMPLE_RATE,
    sourceDurationSamples: SAMPLE_RATE * 2,
    gain: 1,
    waveformData: makeWaveformData(400),
  } as AudioClip;
}

function makeTrack(id: string, clips: AudioClip[]): ClipTrack {
  return { id, name: id, clips, muted: false, soloed: false, volume: 1, pan: 0 } as ClipTrack;
}

function createFakeAdapter(): PlayoutAdapter {
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

let isReady = false;
const ProbeChild: React.FC = () => {
  isReady = usePlaylistTimeline().isReady;
  return null;
};

const CONTROLS = { show: true, width: 200 };

function resetCounts() {
  counts.clip = {};
  counts.channel = 0;
  counts.track = {};
  counts.controls = 0;
}

/** `seconds` of take, as one progress value with `channels` channels of peaks. */
function progressAt(seconds: number, channels = 1): RecordingProgress {
  const pixels = Math.floor((seconds * SAMPLE_RATE) / SAMPLES_PER_PIXEL);
  return {
    duration: seconds,
    peaks: Array.from({ length: channels }, () => new Int16Array(pixels * 2).fill(100)),
  };
}

async function mountRecording(initial: RecordingProgress) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const adapter = createFakeAdapter();
  const createAdapter = () => adapter;
  const tracks = [
    makeTrack('t1', [makeClip('a')]),
    makeTrack('t2', [makeClip('b')]),
    makeTrack('t3', [makeClip('c')]),
  ];
  const { source, publish } = createValueSource(initial);
  const recordingState = {
    isRecording: true,
    trackId: 't2',
    startSample: 0,
    progress: source,
    bits: 16 as const,
    latencyOffset: 0,
  };
  render(
    <WaveformPlaylistProvider
      tracks={tracks}
      sampleRate={SAMPLE_RATE}
      samplesPerPixel={SAMPLES_PER_PIXEL}
      createAdapter={createAdapter}
      controls={CONTROLS}
    >
      <ProbeChild />
      <PlaylistVisualization showClipHeaders recordingState={recordingState} />
    </WaveformPlaylistProvider>
  );
  await waitFor(() => expect(isReady).toBe(true));
  await act(async () => {});
  resetCounts();
  return { publish };
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('recordingDisplayEnd', () => {
  it('keeps between 10 and 20 seconds of timeline ahead of the take', () => {
    for (const end of [0, 0.1, 5, 9.99, 10, 10.01, 25, 123.4]) {
      const lead = recordingDisplayEnd(end) - end;
      expect(lead).toBeGreaterThan(10);
      expect(lead).toBeLessThanOrEqual(20);
    }
  });

  it('changes once per 10 seconds of take', () => {
    const values = new Set<number>();
    for (let end = 0; end < 30; end += 1 / 60) values.add(recordingDisplayEnd(end));
    expect(values.size).toBe(3);
  });
});

describe('live recording preview (#695)', () => {
  it('draws the preview from the source, sized by its duration', async () => {
    const { publish } = await mountRecording({ duration: 0, peaks: [new Int16Array(0)] });
    await act(async () => {
      publish(progressAt(0.5));
    });
    expect(counts.clip['recording-preview']).toBe(1);
    expect(counts.clipDuration['recording-preview']).toBe(SAMPLE_RATE / 2);
  });

  it('shows no preview until the first peaks arrive', async () => {
    const { publish } = await mountRecording({ duration: 0, peaks: [new Int16Array(0)] });
    expect(counts.clip['recording-preview']).toBeUndefined();
    await act(async () => {
      publish({ duration: 0.1, peaks: [new Int16Array(0)] });
    });
    expect(counts.clip['recording-preview']).toBeUndefined();

    await act(async () => {
      publish(progressAt(0.5));
    });

    expect(counts.clip['recording-preview']).toBe(1);
  });

  it('a frame of progress re-renders the preview clip and nothing else', async () => {
    const { publish } = await mountRecording(progressAt(0.5));

    for (let frame = 1; frame <= 5; frame++) {
      await act(async () => {
        publish(progressAt(0.5 + frame / 60));
      });
    }

    expect(counts.clip).toEqual({ 'recording-preview': 5 });
    expect(counts.channel).toBe(5);
    expect(counts.track).toEqual({});
    expect(counts.controls).toBe(0);
    expect(counts.clipDuration['recording-preview']).toBe(Math.floor((0.5 + 5 / 60) * SAMPLE_RATE));
  });

  it('past the end of the timeline, the rows re-render once per step, not per frame', async () => {
    // The three clips end at 1 s; 30 s of take is far past the displayed end.
    const { publish } = await mountRecording(progressAt(30));
    const widthBefore = counts.trackWidth.t1;

    // 2 seconds of frames, crossing no 10-second step.
    for (let frame = 1; frame <= 120; frame++) {
      await act(async () => {
        publish(progressAt(30 + frame / 60));
      });
    }
    expect(counts.track).toEqual({});
    expect(counts.clip).toEqual({ 'recording-preview': 120 });
    expect(counts.trackWidth.t1).toBe(widthBefore);

    // Crossing the step at 40 s widens every row, once.
    resetCounts();
    await act(async () => {
      publish(progressAt(39.99));
    });
    await act(async () => {
      publish(progressAt(40.01));
    });
    await act(async () => {
      publish(progressAt(40.03));
    });
    expect(counts.track).toEqual({ t1: 1, t2: 1, t3: 1 });
    expect(counts.trackWidth.t1).toBeGreaterThan(widthBefore);
    // The existing clips still skip: only their rows got a new width.
    expect(counts.clip).toEqual({ 'recording-preview': 3 });
  });

  it('the timeline always extends past the end of the take', async () => {
    const { publish } = await mountRecording(progressAt(30));
    for (const seconds of [35, 39.99, 40, 47, 52.5]) {
      await act(async () => {
        publish(progressAt(seconds));
      });
      const widthSeconds = (counts.trackWidth.t1 * SAMPLES_PER_PIXEL) / SAMPLE_RATE;
      expect(widthSeconds).toBeGreaterThan(seconds + 9.9);
    }
  });

  it('sizes the armed track for the number of recorded channels', async () => {
    const { publish } = await mountRecording(progressAt(0.5, 1));
    expect(counts.trackChannels.t2).toBe(1);

    await act(async () => {
      publish(progressAt(0.6, 2));
    });

    expect(counts.trackChannels.t2).toBe(2);
    expect(counts.trackChannels.t1).toBe(1);
  });
});
