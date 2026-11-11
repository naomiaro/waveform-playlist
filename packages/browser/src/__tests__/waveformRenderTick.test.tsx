// @vitest-environment jsdom
//
// Timescale label callbacks on <Waveform> (#714). `renderTick` receives the
// formatted label and its pixel position. The deprecated `renderTimestamp`,
// which was documented as receiving milliseconds but received the minutes part
// of the label, is removed.
import './jsdom-polyfills'; // must be first
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import { Waveform } from '../components/Waveform';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;
const SAMPLES_PER_PIXEL = 4096;
const DURATION_SECONDS = 150;

const TRACKS: ClipTrack[] = [
  {
    id: 'track-1',
    name: 'track-1',
    clips: [
      {
        id: 'clip-1',
        startSample: 0,
        durationSamples: DURATION_SECONDS * SAMPLE_RATE,
        offsetSamples: 0,
        sampleRate: SAMPLE_RATE,
      } as AudioClip,
    ],
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  } as ClipTrack,
];

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

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

const adapter = createFakeAdapter();
const createAdapter = () => adapter;

function mount(waveform: React.ReactElement) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  return render(
    <WaveformPlaylistProvider
      tracks={TRACKS}
      sampleRate={SAMPLE_RATE}
      samplesPerPixel={SAMPLES_PER_PIXEL}
      createAdapter={createAdapter}
      timescale
    >
      {waveform}
    </WaveformPlaylistProvider>
  );
}

/** The conversion the upgrade guide gives for code that used `renderTimestamp`. */
function labelToMs(label: string): number {
  const [minutes, seconds] = label.split(':').map(Number);
  return (minutes * 60 + seconds) * 1000;
}

describe('<Waveform> timescale label callbacks', () => {
  it('renderTick receives the formatted label and its pixel position', async () => {
    const calls = new Map<string, number>();
    mount(
      <Waveform
        renderTick={(label, pixelPosition) => {
          calls.set(label, pixelPosition);
          return <span data-tick={label}>{label}</span>;
        }}
      />
    );
    await waitFor(() => expect(calls.size).toBeGreaterThan(0));

    expect([...calls.keys()].slice(0, 4)).toEqual(['0:00', '0:05', '0:10', '0:15']);
    expect(calls.has('1:00')).toBe(true);
    expect(calls.has('2:20')).toBe(true);

    // The label parses to the real time, and the pixel position agrees with it.
    const pixelsPerSecond = SAMPLE_RATE / SAMPLES_PER_PIXEL;
    for (const [label, pixelPosition] of calls) {
      const ms = labelToMs(label);
      expect(pixelPosition).toBe(Math.floor((ms / 1000) * pixelsPerSecond));
    }
    expect(labelToMs('1:00')).toBe(60000);
    expect(labelToMs('2:20')).toBe(140000);
  });

  it('renderTimestamp is no longer a prop', () => {
    // @ts-expect-error -- removed in #714; use renderTick
    const element = <Waveform renderTimestamp={() => null} />;
    expect(element.props).toHaveProperty('renderTimestamp');
  });
});
