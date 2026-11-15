// The drawing record of a clip whose audio is still loading (#812).
import { describe, it, expect, vi, afterEach } from 'vitest';
import WaveformData from 'waveform-data';
import type { LoadingClip, WaveformDataObject } from '@waveform-playlist/core';
import { placeholderPeaks } from '../placeholderPeaks';
import { extractPeaksFromWaveformDataFull } from '../../waveformDataLoader';

const CONTEXT_RATE = 48000;
const FILE_RATE = 44100;
const SCALE = 256;
const OPTIONS = { contextSampleRate: CONTEXT_RATE, samplesPerPixel: 1024, mono: false };

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

  it('a clip with waveformData is drawn from it at the file’s rate', () => {
    const wd = waveformData(400, FILE_RATE) as unknown as WaveformData;
    const record = placeholderPeaks(
      loading({ waveformData: wd as unknown as WaveformDataObject, start: 1 }),
      'Vocals',
      OPTIONS
    );
    expect(record).not.toBeNull();
    expect(record!.sampleRate).toBe(FILE_RATE);
    expect(record!.startSample).toBe(FILE_RATE);
    expect(record!.durationSamples).toBe(Math.ceil(wd.duration * FILE_RATE));
    // The same slice rule as a loaded clip with these peaks: the clip's rate
    // differs from none here, so the expected value is the plain extraction.
    const expected = extractPeaksFromWaveformDataFull(
      wd,
      OPTIONS.samplesPerPixel,
      false,
      0,
      record!.durationSamples
    );
    expect(record!.peaks.length).toBeGreaterThan(0);
    expect(record!.peaks.length).toBe(expected.length);
    expect(Array.from(record!.peaks.data[0])).toEqual(Array.from(expected.data[0]));
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
});
