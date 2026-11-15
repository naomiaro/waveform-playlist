// The drawing record of a clip whose audio is still loading (#812).
import { describe, it, expect, vi, afterEach } from 'vitest';
import WaveformData from 'waveform-data';
import { createTrack, isLoadingClip } from '@waveform-playlist/core';
import type {
  ArrangementTrack,
  AudioClip,
  LoadingClip,
  WaveformDataObject,
} from '@waveform-playlist/core';
import { attachDecodeContext, createArrangement } from '@waveform-playlist/engine';
import { placeholderPeaks } from '../placeholderPeaks';
import { clipPeaksFor } from '../derivePeaks';
import { extractPeaksFromWaveformDataFull } from '../../waveformDataLoader';

const CONTEXT_RATE = 48000;
const FILE_RATE = 44100;
const SCALE = 256;
const OPTIONS = { contextSampleRate: CONTEXT_RATE, samplesPerPixel: 1024, mono: false };
/** A context at the peaks file's own rate: the cases where the two rates agree. */
const SAME_RATE = { ...OPTIONS, contextSampleRate: FILE_RATE };

function waveformData(bins: number, sampleRate: number): WaveformDataObject {
  const data: number[] = [];
  for (let i = 0; i < bins; i++) data.push(-(i % 100), i % 100);
  return WaveformData.create({
    version: 2,
    channels: 1,
    sample_rate: sampleRate,
    samples_per_pixel: SCALE,
    bits: 16,
    length: bins,
    data,
  }) as unknown as WaveformDataObject;
}

function loading(overrides: Partial<LoadingClip> = {}): LoadingClip {
  return { id: 'c1', src: '/a.mp3', ...overrides } as LoadingClip;
}

afterEach(() => vi.restoreAllMocks());

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * The clip the engine makes of `clip` once its audio is decoded at the
 * context's rate: a buffer of the peaks file's length in seconds, at
 * `CONTEXT_RATE` (what decodeAudioData gives on a 48000 context).
 */
async function loadedAtContextRate(clip: LoadingClip, wd: WaveformData): Promise<AudioClip> {
  const buffer = {
    sampleRate: CONTEXT_RATE,
    length: Math.round(wd.duration * CONTEXT_RATE),
    duration: wd.duration,
    numberOfChannels: 1,
  } as AudioBuffer;
  const track = { ...createTrack({ name: 'T', clips: [] }), id: 'T', clips: [clip] };
  const arrangement = createArrangement({
    tracks: [track as ArrangementTrack],
    loadSource: async () => buffer,
  });
  attachDecodeContext(arrangement, async () => ({}) as BaseAudioContext);
  await flush();
  const loaded = arrangement.getTracks()[0].clips[0];
  if (isLoadingClip(loaded)) throw new Error('the clip did not load');
  return loaded;
}

describe('placeholderPeaks', () => {
  it('a clip with a duration and no peaks gives an empty box of that length at the context rate', () => {
    const record = placeholderPeaks(loading({ start: 1, duration: 2 }), 'Vocals', OPTIONS);
    expect(record).not.toBeNull();
    expect(record!.isPlaceholder).toBe(true);
    expect(record!.clipId).toBe('c1');
    expect(record!.trackName).toBe('Vocals');
    expect(record!.sampleRate).toBe(CONTEXT_RATE);
    expect(record!.startSample).toBe(CONTEXT_RATE);
    expect(record!.durationSamples).toBe(2 * CONTEXT_RATE);
    expect(record!.offsetSamples).toBe(0);
    expect(record!.peaks.length).toBe(0);
    expect(record!.peaks.data.every((channel) => channel.length === 0)).toBe(true);
  });

  it('a clip with waveformData at the context’s rate is drawn from it', () => {
    const wd = waveformData(400, FILE_RATE) as unknown as WaveformData;
    const record = placeholderPeaks(
      loading({ waveformData: wd as unknown as WaveformDataObject, start: 1 }),
      'Vocals',
      SAME_RATE
    );
    expect(record).not.toBeNull();
    expect(record!.sampleRate).toBe(FILE_RATE);
    expect(record!.startSample).toBe(FILE_RATE);
    expect(record!.durationSamples).toBe(Math.ceil(wd.duration * FILE_RATE));
    // The same slice rule as a loaded clip with these peaks: the clip's rate
    // differs from none here, so the expected value is the plain extraction.
    const expected = extractPeaksFromWaveformDataFull(
      wd,
      SAME_RATE.samplesPerPixel,
      false,
      0,
      record!.durationSamples
    );
    expect(record!.peaks.length).toBeGreaterThan(0);
    expect(record!.peaks.length).toBe(expected.length);
    expect(Array.from(record!.peaks.data[0])).toEqual(Array.from(expected.data[0]));
  });

  it('a peaks file at 44100 on a 48000 context gives the geometry the loaded clip will have', async () => {
    const wd = waveformData(400, FILE_RATE) as unknown as WaveformData;
    const data = wd as unknown as WaveformDataObject;
    // With no duration (cut to the file's end) and with one.
    for (const fields of [
      { start: 1, offset: 0.5 },
      { start: 1.25, offset: 0.25, duration: 1 },
    ]) {
      const clip = loading({ waveformData: data, ...fields });
      const record = placeholderPeaks(clip, 'T', OPTIONS);
      const loaded = await loadedAtContextRate(clip, wd);
      expect(record).not.toBeNull();
      expect(record!.sampleRate).toBe(CONTEXT_RATE);
      expect(loaded.sampleRate).toBe(CONTEXT_RATE);
      expect(record!.startSample).toBe(loaded.startSample);
      expect(record!.offsetSamples).toBe(loaded.offsetSamples);
      expect(Math.abs(record!.durationSamples - loaded.durationSamples)).toBeLessThanOrEqual(1);
      // Drawn as the loaded clip will be: the same peaks, converted through
      // the ratio of the two rates.
      const drawn = clipPeaksFor(loaded, 'T', {
        samplesPerPixel: OPTIONS.samplesPerPixel,
        mono: false,
        getGeneratedWaveformData: () => undefined,
      }).clipPeaks.peaks;
      expect(record!.peaks.length).toBeGreaterThan(0);
      expect(record!.peaks.length).toBe(drawn.length);
      expect(Array.from(record!.peaks.data[0])).toEqual(Array.from(drawn.data[0]));
    }
  });

  it('a duration past the end of the peaks file is cut to the file\u2019s end', () => {
    const wd = waveformData(400, FILE_RATE);
    const total = Math.ceil((wd as unknown as WaveformData).duration * FILE_RATE);
    const record = placeholderPeaks(
      loading({ waveformData: wd, offset: 1, duration: 100 }),
      'T',
      SAME_RATE
    );
    expect(record!.offsetSamples).toBe(FILE_RATE);
    expect(record!.durationSamples).toBe(total - FILE_RATE);
  });

  it('an offset at or past the end of the peaks file gives null', () => {
    const wd = waveformData(400, FILE_RATE);
    const total = Math.ceil((wd as unknown as WaveformData).duration * FILE_RATE);
    for (const offset of [total / FILE_RATE, total / FILE_RATE + 1]) {
      expect(placeholderPeaks(loading({ waveformData: wd, offset }), 'T', SAME_RATE)).toBeNull();
      expect(
        placeholderPeaks(loading({ waveformData: wd, offset, duration: 1 }), 'T', SAME_RATE)
      ).toBeNull();
    }
  });

  it('an offset at or past the end of a 44100 file on a 48000 context gives null', () => {
    const wd = waveformData(400, FILE_RATE) as unknown as WaveformData;
    const data = wd as unknown as WaveformDataObject;
    // The file's end in seconds, and one second past it.
    for (const offset of [wd.duration, wd.duration + 1]) {
      expect(placeholderPeaks(loading({ waveformData: data, offset }), 'T', OPTIONS)).toBeNull();
      expect(
        placeholderPeaks(loading({ waveformData: data, offset, duration: 1 }), 'T', OPTIONS)
      ).toBeNull();
    }
    // Just before the end there is still a clip, at the context's rate.
    const before = placeholderPeaks(
      loading({ waveformData: data, offset: wd.duration - 0.5 }),
      'T',
      OPTIONS
    );
    expect(before).not.toBeNull();
    expect(before!.sampleRate).toBe(CONTEXT_RATE);
    expect(before!.durationSamples).toBe(
      Math.ceil(wd.duration * CONTEXT_RATE) - Math.round((wd.duration - 0.5) * CONTEXT_RATE)
    );
  });

  it('no duration and no waveformData gives null', () => {
    expect(placeholderPeaks(loading({ start: 1 }), 'T', OPTIONS)).toBeNull();
  });

  it('a negative start gives null', () => {
    expect(placeholderPeaks(loading({ start: -1, duration: 1 }), 'T', OPTIONS)).toBeNull();
  });

  it('the same loading clip and options return the same object', () => {
    const clip = loading({ duration: 1 });
    const first = placeholderPeaks(clip, 'T', OPTIONS);
    expect(placeholderPeaks(clip, 'T', { ...OPTIONS })).toBe(first);
    expect(placeholderPeaks(clip, 'T', { ...OPTIONS, mono: true })).not.toBe(first);
    expect(placeholderPeaks(loading({ duration: 1 }), 'T', OPTIONS)).not.toBe(first);
  });

  it('a null duration is read as not given', () => {
    const wd = waveformData(400, FILE_RATE) as unknown as WaveformData;
    const withNull = placeholderPeaks(
      loading({
        waveformData: wd as unknown as WaveformDataObject,
        duration: null as unknown as undefined,
      }),
      'T',
      SAME_RATE
    );
    expect(withNull).not.toBeNull();
    expect(withNull!.durationSamples).toBe(Math.ceil(wd.duration * FILE_RATE));
    // Without peaks there is no length: null, as for a missing duration.
    expect(
      placeholderPeaks(loading({ duration: null as unknown as undefined }), 'T', OPTIONS)
    ).toBeNull();
  });
});
