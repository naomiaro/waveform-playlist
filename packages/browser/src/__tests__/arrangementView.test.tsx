// @vitest-environment jsdom
//
// The view of an arrangement (#812): what the provider will publish, derived
// from the arrangement and never written back. Loaded tracks, one drawing
// row per track with the placeholder records of the clips still loading,
// `trackStates` from the arrangement's mixer, and its undo state.
import './jsdom-polyfills'; // must be first
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../workers/peaksWorker', () => ({
  // A worker whose jobs never finish: nothing here is drawn from generated peaks.
  createPeaksWorker: vi.fn(() => ({
    generate: () => new Promise(() => {}),
    isTerminated: () => false,
    terminate: () => {},
  })),
}));

import { renderHook, act, cleanup } from '@testing-library/react';
import WaveformData from 'waveform-data';
import { createClip, createTrack } from '@waveform-playlist/core';
import type {
  ArrangementTrack,
  AudioClip,
  ClipSource,
  LoadingClip,
  WaveformDataObject,
} from '@waveform-playlist/core';
import { attachDecodeContext, createArrangement } from '@waveform-playlist/engine';
import type { Arrangement, LoadSource } from '@waveform-playlist/engine';
import {
  useArrangementView,
  type ArrangementViewOptions,
} from '../providerInternals/useArrangementView';

const RATE = 48000;
const OPTIONS: ArrangementViewOptions = {
  samplesPerPixel: 1024,
  mono: false,
  baseScale: 256,
  placeholderSampleRate: RATE,
};

function clip(id: string, startSeconds: number, seconds = 1): AudioClip {
  return {
    ...createClip({
      startSample: startSeconds * RATE,
      durationSamples: seconds * RATE,
      offsetSamples: 0,
      sampleRate: RATE,
      sourceDurationSamples: 8 * RATE,
    }),
    id,
  };
}

function loading(id: string, fields: Partial<LoadingClip> = {}): LoadingClip {
  return { id, src: `/${id}.opus`, ...fields } as LoadingClip;
}

function track(id: string, clips: ArrangementTrack['clips']): ArrangementTrack {
  return { ...createTrack({ name: id, clips: [] }), id, clips } as ArrangementTrack;
}

function waveformData(seconds: number): WaveformDataObject {
  const bins = Math.ceil((seconds * RATE) / 256);
  const data: number[] = [];
  for (let i = 0; i < bins; i++) data.push(-(i % 100), i % 100);
  return WaveformData.create({
    version: 2,
    channels: 1,
    sample_rate: RATE,
    samples_per_pixel: 256,
    bits: 16,
    length: bins,
    data,
  }) as unknown as WaveformDataObject;
}

function fakeBuffer(seconds: number): AudioBuffer {
  return {
    sampleRate: RATE,
    length: seconds * RATE,
    duration: seconds,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(seconds * RATE),
  } as unknown as AudioBuffer;
}

/** A `loadSource` that keeps every call pending until the test settles it. */
function fakeLoads() {
  const calls: Array<{ src: ClipSource; resolve(buffer: AudioBuffer): void }> = [];
  const loadSource: LoadSource = (src) =>
    new Promise<AudioBuffer>((resolve) => {
      calls.push({ src, resolve });
    });
  return { calls, loadSource };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function view(arrangement: Arrangement, options: ArrangementViewOptions = OPTIONS) {
  return renderHook((props: ArrangementViewOptions) => useArrangementView(arrangement, props), {
    initialProps: options,
  });
}

const rowIds = (row: { clipId: string }[]) => row.map((record) => record.clipId);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useArrangementView', () => {
  it('a fader move changes `trackStates` and not `tracks` or `peaksDataArray`', () => {
    const arrangement = createArrangement({
      tracks: [
        track('A', [clip('a1', 0)]),
        track('B', [clip('b1', 0), loading('L', { start: 2, duration: 1 })]),
      ],
    });
    const { result } = view(arrangement);
    const before = result.current;
    expect(before.trackStates.map((s) => s.volume)).toEqual([1, 1]);

    act(() => arrangement.setTrackVolume('A', 0.5));

    const after = result.current;
    expect(after.trackStates).not.toBe(before.trackStates);
    expect(after.trackStates[0]).toEqual({
      name: 'A',
      volume: 0.5,
      muted: false,
      soloed: false,
      pan: 0,
    });
    expect(after.trackStates[1]).toBe(before.trackStates[1]);
    expect(after.tracks).toBe(before.tracks);
    expect(after.peaksDataArray).toBe(before.peaksDataArray);
    expect(after.peaksOptions).toBe(before.peaksOptions);
  });

  it('an arrival replaces the placeholder record with the loaded clip’s record at the same position', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({
      tracks: [
        track('A', [
          clip('a1', 0),
          loading('L', { start: 2, duration: 1, waveformData: waveformData(4) }),
          clip('a3', 5),
        ]),
      ],
      loadSource: loads.loadSource,
    });
    attachDecodeContext(arrangement, async () => ({}) as BaseAudioContext);
    const { result } = view(arrangement);
    await act(flush);

    const before = result.current;
    expect(rowIds(before.peaksDataArray[0])).toEqual(['a1', 'L', 'a3']);
    expect(before.peaksDataArray[0][1].isPlaceholder).toBe(true);
    expect(before.tracks[0].clips.map((c) => c.id)).toEqual(['a1', 'a3']);
    expect(before.peaksCacheRef.current.clips.has('L')).toBe(false);

    await act(async () => {
      loads.calls[0].resolve(fakeBuffer(4));
      await flush();
    });

    const after = result.current;
    const row = after.peaksDataArray[0];
    expect(rowIds(row)).toEqual(['a1', 'L', 'a3']);
    expect(row[1].isPlaceholder).toBe(false);
    expect(row[1].startSample).toBe(2 * RATE);
    expect(row[1].peaks.length).toBeGreaterThan(0);
    expect(row[0]).toBe(before.peaksDataArray[0][0]);
    expect(row[2]).toBe(before.peaksDataArray[0][2]);
    expect(after.tracks[0].clips.map((c) => c.id)).toEqual(['a1', 'L', 'a3']);
    expect(after.peaksCacheRef.current.clips.get('L')?.clipPeaks).toBe(row[1]);
  });

  it('`duration` ignores a placeholder that ends later, `placeholdersEnd` reports it', () => {
    const arrangement = createArrangement({
      tracks: [
        track('A', [clip('a1', 0, 1)]),
        track('B', [loading('L', { start: 3, duration: 2 })]),
      ],
    });
    const { result } = view(arrangement);
    expect(result.current.duration).toBe(1);
    expect(result.current.placeholdersEnd).toBe(5);

    act(() => arrangement.removeTrack('B'));
    expect(result.current.placeholdersEnd).toBe(0);
    expect(result.current.duration).toBe(1);
  });

  it('a track with only a loading clip without duration has a row with no entries and a `trackStates` entry', () => {
    const arrangement = createArrangement({
      tracks: [track('A', [clip('a1', 0)]), track('B', [loading('L')])],
    });
    const { result } = view(arrangement);
    expect(result.current.tracks).toHaveLength(2);
    expect(result.current.tracks[1].clips).toEqual([]);
    expect(result.current.peaksDataArray).toHaveLength(2);
    expect(result.current.peaksDataArray[1]).toEqual([]);
    expect(result.current.trackStates).toHaveLength(2);
    expect(result.current.trackStates[1]).toEqual({
      name: 'B',
      volume: 1,
      muted: false,
      soloed: false,
      pan: 0,
    });
    expect(result.current.placeholdersEnd).toBe(0);
  });

  it('`canUndo` follows `moveClip`, `undo` and `clearHistory`', () => {
    const arrangement = createArrangement({ tracks: [track('A', [clip('a1', 0)])] });
    const { result } = view(arrangement);
    expect([result.current.canUndo, result.current.canRedo]).toEqual([false, false]);

    act(() => {
      arrangement.moveClip('A', 'a1', RATE);
    });
    expect([result.current.canUndo, result.current.canRedo]).toEqual([true, false]);

    act(() => arrangement.undo());
    expect([result.current.canUndo, result.current.canRedo]).toEqual([false, true]);

    act(() => arrangement.redo());
    act(() => arrangement.clearHistory());
    expect([result.current.canUndo, result.current.canRedo]).toEqual([false, false]);
  });

  it('a clip move keeps `trackStates` and the other rows; a rename gives that track a new entry with its name', () => {
    const arrangement = createArrangement({
      tracks: [
        track('A', [clip('a1', 0)]),
        track('B', [clip('b1', 0), loading('L', { start: 2, duration: 1 })]),
      ],
    });
    const { result } = view(arrangement);
    const states = result.current.trackStates;
    const tracks = result.current.tracks;
    const rows = result.current.peaksDataArray;

    act(() => {
      arrangement.moveClip('A', 'a1', RATE);
    });
    expect(result.current.tracks).not.toBe(tracks);
    expect(result.current.trackStates).toBe(states);
    expect(result.current.peaksDataArray).not.toBe(rows);
    expect(result.current.peaksDataArray[0]).not.toBe(rows[0]);
    // The row with a placeholder in it is rebuilt from the same records: kept.
    expect(result.current.peaksDataArray[1]).toBe(rows[1]);

    act(() => arrangement.updateTrack('B', (t) => ({ ...t, name: 'Bass' })));
    expect(result.current.trackStates).not.toBe(states);
    expect(result.current.trackStates[0]).toBe(states[0]);
    expect(result.current.trackStates[1].name).toBe('Bass');
  });

  it('no placeholder record while the rate is not known; it appears, at the real rate, when it is', () => {
    const arrangement = createArrangement({
      tracks: [track('A', [clip('a1', 0), loading('L', { start: 2, duration: 1 })])],
    });
    const { result, rerender } = view(arrangement, { ...OPTIONS, placeholderSampleRate: null });
    expect(rowIds(result.current.peaksDataArray[0])).toEqual(['a1']);
    expect(result.current.placeholdersEnd).toBe(0);

    const realRate = 44100;
    rerender({ ...OPTIONS, placeholderSampleRate: realRate });
    const row = result.current.peaksDataArray[0];
    expect(rowIds(row)).toEqual(['a1', 'L']);
    expect(row[1].isPlaceholder).toBe(true);
    expect(row[1].sampleRate).toBe(realRate);
    expect(row[1].startSample).toBe(2 * realRate);
    expect(result.current.placeholdersEnd).toBe(3);
  });
});
