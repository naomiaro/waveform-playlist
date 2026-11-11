// Per-clip peaks cache (#692). The provider derives `peaksDataArray` during
// render; what makes that cheap is that a clip whose inputs did not change
// keeps the SAME typed arrays, the same `ClipPeaks` object and (when nothing
// in its track changed) the same per-track array. Canvas redraws, clip
// re-renders and row re-renders are each keyed on one of those identities.
import { describe, it, expect, vi, afterEach } from 'vitest';
import WaveformData from 'waveform-data';
import type { AudioClip, ClipTrack } from '@waveform-playlist/core';
import { derivePeaks, EMPTY_PEAKS_CACHE } from '../utils/derivePeaks';

const SAMPLE_RATE = 48000;
const SCALE = 256;

function makeWaveformData(bins: number, sampleRate = SAMPLE_RATE): WaveformData {
  const data: number[] = [];
  for (let i = 0; i < bins; i++) {
    data.push(-(i % 100), i % 100);
  }
  return WaveformData.create({
    version: 2,
    channels: 1,
    sample_rate: sampleRate,
    samples_per_pixel: SCALE,
    bits: 16,
    length: bins,
    data,
  });
}

function makeBuffer(channels = 1): AudioBuffer {
  return { numberOfChannels: channels, sampleRate: SAMPLE_RATE } as unknown as AudioBuffer;
}

function makeClip(id: string, overrides: Partial<AudioClip> = {}): AudioClip {
  return {
    id,
    startSample: 0,
    durationSamples: SCALE * 40,
    offsetSamples: 0,
    sampleRate: SAMPLE_RATE,
    sourceDurationSamples: SCALE * 400,
    gain: 1,
    ...overrides,
  } as AudioClip;
}

function makeTrack(id: string, clips: AudioClip[]): ClipTrack {
  return { id, name: id, clips, muted: false, soloed: false, volume: 1, pan: 0 } as ClipTrack;
}

const OPTIONS = { samplesPerPixel: 1024, mono: false };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('derivePeaks', () => {
  it('extracts peaks from the generated waveform data of the clip buffer', () => {
    const buffer = makeBuffer();
    const generated = makeWaveformData(400);
    const tracks = [makeTrack('t1', [makeClip('a', { audioBuffer: buffer })])];

    const { result } = derivePeaks(
      tracks,
      { ...OPTIONS, getGeneratedWaveformData: (b) => (b === buffer ? generated : undefined) },
      EMPTY_PEAKS_CACHE
    );

    expect(result).toHaveLength(1);
    expect(result[0][0].clipId).toBe('a');
    expect(result[0][0].trackName).toBe('t1');
    expect(result[0][0].peaks.length).toBe(10);
  });

  it('returns everything by identity when nothing changed', () => {
    const buffer = makeBuffer();
    const generated = makeWaveformData(400);
    const getGeneratedWaveformData = () => generated;
    const tracks = [makeTrack('t1', [makeClip('a', { audioBuffer: buffer })])];
    const first = derivePeaks(tracks, { ...OPTIONS, getGeneratedWaveformData }, EMPTY_PEAKS_CACHE);

    // A new tracks array with new track objects, as an engine statechange produces.
    const again = [makeTrack('t1', [...tracks[0].clips])];
    const second = derivePeaks(again, { ...OPTIONS, getGeneratedWaveformData }, first);

    expect(second.result).toBe(first.result);
  });

  it('gives new arrays only to the clip that was trimmed', () => {
    const buffer = makeBuffer();
    const generated = makeWaveformData(400);
    const getGeneratedWaveformData = () => generated;
    const a = makeClip('a', { audioBuffer: buffer });
    const b = makeClip('b', { audioBuffer: buffer, startSample: SCALE * 100 });
    const c = makeClip('c', { audioBuffer: buffer });
    const first = derivePeaks(
      [makeTrack('t1', [a, b]), makeTrack('t2', [c])],
      { ...OPTIONS, getGeneratedWaveformData },
      EMPTY_PEAKS_CACHE
    );

    const trimmed = { ...a, durationSamples: SCALE * 20 };
    const second = derivePeaks(
      [makeTrack('t1', [trimmed, b]), makeTrack('t2', [c])],
      { ...OPTIONS, getGeneratedWaveformData },
      first
    );

    expect(second.result).not.toBe(first.result);
    // The trimmed clip: new peaks.
    expect(second.result[0][0].peaks).not.toBe(first.result[0][0].peaks);
    expect(second.result[0][0].peaks.length).toBe(5);
    // Its neighbour on the same track: same ClipPeaks object.
    expect(second.result[0][1]).toBe(first.result[0][1]);
    // The other track: same array.
    expect(second.result[1]).toBe(first.result[1]);
  });

  it('keeps the typed arrays when a clip only moves', () => {
    const generated = makeWaveformData(400);
    const getGeneratedWaveformData = () => generated;
    const a = makeClip('a', { audioBuffer: makeBuffer() });
    const first = derivePeaks(
      [makeTrack('t1', [a])],
      { ...OPTIONS, getGeneratedWaveformData },
      EMPTY_PEAKS_CACHE
    );

    const moved = { ...a, startSample: SCALE * 8 };
    const second = derivePeaks(
      [makeTrack('t1', [moved])],
      { ...OPTIONS, getGeneratedWaveformData },
      first
    );

    expect(second.result[0][0]).not.toBe(first.result[0][0]);
    expect(second.result[0][0].startSample).toBe(SCALE * 8);
    expect(second.result[0][0].peaks).toBe(first.result[0][0].peaks);
  });

  it('recomputes every clip when zoom or mono changes', () => {
    const generated = makeWaveformData(400);
    const getGeneratedWaveformData = () => generated;
    const tracks = [makeTrack('t1', [makeClip('a', { audioBuffer: makeBuffer() })])];
    const first = derivePeaks(tracks, { ...OPTIONS, getGeneratedWaveformData }, EMPTY_PEAKS_CACHE);

    const zoomed = derivePeaks(
      tracks,
      { samplesPerPixel: 2048, mono: false, getGeneratedWaveformData },
      first
    );
    expect(zoomed.result[0][0].peaks).not.toBe(first.result[0][0].peaks);
    expect(zoomed.result[0][0].peaks.length).toBe(5);

    const mono = derivePeaks(
      tracks,
      { samplesPerPixel: 1024, mono: true, getGeneratedWaveformData },
      first
    );
    expect(mono.result[0][0].peaks).not.toBe(first.result[0][0].peaks);
  });

  it('replaces empty peaks once the worker result for the buffer arrives', () => {
    const buffer = makeBuffer(2);
    const tracks = [makeTrack('t1', [makeClip('a', { audioBuffer: buffer })])];
    const first = derivePeaks(
      tracks,
      { ...OPTIONS, getGeneratedWaveformData: () => undefined },
      EMPTY_PEAKS_CACHE
    );
    // Empty, but with the buffer's channel count so the track height does not jump.
    expect(first.result[0][0].peaks.length).toBe(0);
    expect(first.result[0][0].peaks.data).toHaveLength(2);

    const generated = makeWaveformData(400);
    const second = derivePeaks(
      tracks,
      { ...OPTIONS, getGeneratedWaveformData: () => generated },
      first
    );
    expect(second.result[0][0].peaks.length).toBe(10);
  });

  it('prefers the clip own waveformData and ignores a later worker result', () => {
    const buffer = makeBuffer();
    const own = makeWaveformData(400);
    const tracks = [makeTrack('t1', [makeClip('a', { audioBuffer: buffer, waveformData: own })])];
    const first = derivePeaks(
      tracks,
      { ...OPTIONS, getGeneratedWaveformData: () => undefined },
      EMPTY_PEAKS_CACHE
    );
    expect(first.result[0][0].peaks.length).toBe(10);

    const second = derivePeaks(
      tracks,
      { ...OPTIONS, getGeneratedWaveformData: () => makeWaveformData(400) },
      first
    );
    expect(second.result).toBe(first.result);
  });

  it('converts offsets when the waveformData sample rate differs from the clip', () => {
    const own = makeWaveformData(400, 44100);
    const clip = makeClip('a', { waveformData: own, durationSamples: 48000, sampleRate: 48000 });
    const { result } = derivePeaks(
      [makeTrack('t1', [clip])],
      { samplesPerPixel: 1024, mono: false, getGeneratedWaveformData: () => undefined },
      EMPTY_PEAKS_CACHE
    );
    // One second of audio at 48000 Hz and 1024 samples per pixel is ~47 px.
    expect(result[0][0].peaks.length).toBeGreaterThanOrEqual(46);
    expect(result[0][0].peaks.length).toBeLessThanOrEqual(48);
  });

  it('gives a MIDI clip empty peaks as wide as the clip', () => {
    const clip = makeClip('m', {
      durationSamples: 10240,
      midiNotes: [{ midi: 60, name: 'C4', time: 0, duration: 0.1, velocity: 1 }],
    } as Partial<AudioClip>);
    const { result } = derivePeaks(
      [makeTrack('t1', [clip])],
      { ...OPTIONS, getGeneratedWaveformData: () => undefined },
      EMPTY_PEAKS_CACHE
    );
    expect(result[0][0].peaks.length).toBe(10);
    expect(result[0][0].midiNotes).toBe(clip.midiNotes);
  });

  it('forgets clips that are gone', () => {
    const generated = makeWaveformData(400);
    const getGeneratedWaveformData = () => generated;
    const a = makeClip('a', { audioBuffer: makeBuffer() });
    const first = derivePeaks(
      [makeTrack('t1', [a])],
      { ...OPTIONS, getGeneratedWaveformData },
      EMPTY_PEAKS_CACHE
    );
    const empty = derivePeaks([], { ...OPTIONS, getGeneratedWaveformData }, first);
    expect(empty.result).toEqual([]);

    const back = derivePeaks(
      [makeTrack('t1', [a])],
      { ...OPTIONS, getGeneratedWaveformData },
      empty
    );
    expect(back.result[0][0].peaks).not.toBe(first.result[0][0].peaks);
  });

  it('falls back to empty peaks and warns once when extraction throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const broken = {
      sample_rate: SAMPLE_RATE,
      get scale(): number {
        throw new Error('corrupt');
      },
    } as unknown as WaveformData;
    const tracks = [makeTrack('t1', [makeClip('a', { waveformData: broken })])];
    const options = { ...OPTIONS, getGeneratedWaveformData: () => undefined };

    const first = derivePeaks(tracks, options, EMPTY_PEAKS_CACHE);
    expect(first.result[0][0].peaks.length).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);

    const second = derivePeaks(tracks, options, first);
    expect(second.result).toBe(first.result);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
