/**
 * placeholderPeaks
 *
 * The drawing record of a clip whose audio is still loading (#812). It is a
 * `ClipPeaks` with `isPlaceholder: true` and exists nowhere else: no tracks
 * array holds a clip for it. The caller finds it by `clipId`.
 *
 * Drawn from the loading clip's own `waveformData` when it has usable ones,
 * else an empty box as long as its `duration`. `null` when neither gives a
 * length, or when a time is not a usable number.
 */
import type { LoadingClip } from '@waveform-playlist/core';
import type WaveformData from 'waveform-data';
import type { ClipPeaks } from '../WaveformPlaylistContext';
import { extractFromOwnWaveformData } from './derivePeaks';

export interface PlaceholderPeaksOptions {
  contextSampleRate: number;
  samplesPerPixel: number;
  mono: boolean;
}

interface MemoEntry {
  trackName: string;
  options: PlaceholderPeaksOptions;
  result: ClipPeaks | null;
}

// The last result per loading-clip object: the provider asks again on every
// derivation and a new object would redraw the row.
const memo = new WeakMap<LoadingClip, MemoEntry>();

function sameOptions(a: PlaceholderPeaksOptions, b: PlaceholderPeaksOptions): boolean {
  return (
    a.contextSampleRate === b.contextSampleRate &&
    a.samplesPerPixel === b.samplesPerPixel &&
    a.mono === b.mono
  );
}

function isTime(value: number | undefined): boolean {
  return value === undefined || (Number.isFinite(value) && value >= 0);
}

function usableWaveformData(clip: LoadingClip): WaveformData | undefined {
  const data = clip.waveformData as WaveformData | undefined;
  if (!data) return undefined;
  const ok =
    Number.isFinite(data.sample_rate) &&
    data.sample_rate > 0 &&
    Number.isFinite(data.duration) &&
    data.duration >= 0;
  return ok ? data : undefined;
}

function build(
  clip: LoadingClip,
  trackName: string,
  options: PlaceholderPeaksOptions
): ClipPeaks | null {
  const wdata = usableWaveformData(clip);
  if (clip.duration === undefined && !wdata) return null;
  if (!isTime(clip.start) || !isTime(clip.offset) || !isTime(clip.duration)) return null;
  const rate = wdata ? wdata.sample_rate : options.contextSampleRate;
  if (!(Number.isFinite(rate) && rate > 0)) return null;

  const startSample = Math.round((clip.start ?? 0) * rate);
  const offsetSamples = Math.round((clip.offset ?? 0) * rate);
  // With peaks the clip cannot be longer than the file: the same cut as the
  // loaded clip's. An offset at or past the end leaves no samples (`rest` < 1),
  // which gives null below.
  const total = wdata ? Math.ceil(wdata.duration * rate) : undefined;
  const rest = total === undefined ? undefined : total - offsetSamples;
  const wanted = clip.duration === undefined ? rest : Math.round(clip.duration * rate);
  const durationSamples =
    rest === undefined ? (wanted as number) : Math.min(wanted as number, rest);
  if (![startSample, offsetSamples, durationSamples, total ?? 0].every(Number.isSafeInteger)) {
    return null;
  }
  if (durationSamples < 1) return null;

  const drawn = wdata
    ? extractFromOwnWaveformData(
        { sampleRate: rate, offsetSamples, durationSamples },
        wdata,
        options.samplesPerPixel,
        options.mono
      )
    : undefined;
  const peaks = drawn ?? { length: 0, data: [new Int16Array(0)], bits: 16 as const };

  return {
    clipId: clip.id,
    trackName,
    peaks,
    startSample,
    durationSamples,
    offsetSamples,
    sampleRate: rate,
    fadeIn: clip.fadeIn,
    fadeOut: clip.fadeOut,
    gain: clip.gain,
    isPlaceholder: true,
  };
}

export function placeholderPeaks(
  clip: LoadingClip,
  trackName: string,
  options: PlaceholderPeaksOptions
): ClipPeaks | null {
  const hit = memo.get(clip);
  if (hit && hit.trackName === trackName && sameOptions(hit.options, options)) return hit.result;
  const result = build(clip, trackName, options);
  memo.set(clip, { trackName, options: { ...options }, result });
  return result;
}
