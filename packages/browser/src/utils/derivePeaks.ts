/**
 * derivePeaks
 *
 * Turns `tracks` into the per-track, per-clip peaks the visualization draws,
 * reusing everything from the previous pass that still applies (#692).
 *
 * Three identities are preserved, because three different things are keyed on
 * them downstream:
 *  - the typed arrays (`ClipPeaks.peaks`): `Channel` redraws its canvas when
 *    they change;
 *  - the `ClipPeaks` object: a memoized clip re-renders when it changes;
 *  - the per-track array: a memoized track row re-renders when it changes.
 *
 * Peak sources, in priority order:
 *   A) `clip.waveformData` — external pre-computed peaks (e.g. BBC audiowaveform)
 *   B) worker-generated WaveformData for `clip.audioBuffer`
 *   C) empty peaks — the clip is still loading, or is a MIDI clip
 *
 * `placeholderIds` (#812): the clips the provider draws but the engine does not
 * hold, whose `ClipPeaks.isPlaceholder` is true. The provider keeps the set's
 * identity while its contents are unchanged; a clip whose flag is unchanged
 * keeps its `ClipPeaks` object whatever happens to the set.
 *
 * The function does not mutate `previous`; the caller keeps the returned cache
 * and passes it to the next call.
 */

import type { AudioClip, ClipTrack, PeakData } from '@waveform-playlist/core';
import type WaveformData from 'waveform-data';
import { extractPeaksFromWaveformDataFull } from '../waveformDataLoader';
import type { ClipPeaks, TrackClipPeaks } from '../WaveformPlaylistContext';

export interface DerivePeaksOptions {
  samplesPerPixel: number;
  mono: boolean;
  /** Worker-generated waveform data for a buffer, when it is ready. */
  getGeneratedWaveformData: (audioBuffer: AudioBuffer) => WaveformData | undefined;
}

/** What a clip's typed arrays were computed from. */
interface PeakInputs {
  waveformData: WaveformData | undefined;
  /** Compared only when path A is absent or failed (`usesGenerated`). */
  generated: WaveformData | undefined;
  offsetSamples: number;
  durationSamples: number;
  sampleRate: number;
  samplesPerPixel: number;
  mono: boolean;
  /** Channel count used for empty peaks (path C). */
  fallbackChannels: number;
  isMidi: boolean;
}

interface ClipEntry {
  inputs: PeakInputs;
  /** True when path A was absent or failed, so `generated` matters. */
  usesGenerated: boolean;
  peaks: PeakData;
  clipPeaks: ClipPeaks;
}

export interface PeaksCache {
  readonly clips: ReadonlyMap<string, ClipEntry>;
  readonly tracks: ReadonlyMap<string, TrackClipPeaks>;
  readonly result: TrackClipPeaks[];
}

export const EMPTY_PEAKS_CACHE: PeaksCache = {
  clips: new Map(),
  tracks: new Map(),
  result: [],
};

function extractFromOwnWaveformData(
  clip: AudioClip,
  waveformData: WaveformData,
  samplesPerPixel: number,
  mono: boolean
): PeakData | undefined {
  // When sample rates match, use clip offsets directly. When they differ (e.g.
  // waveformData at 48000 Hz, clip rebuilt at 44100 Hz after audio decode),
  // convert offsets to the waveformData's sample space and adjust
  // samplesPerPixel so peaks fill the correct container width.
  try {
    const wdRate = waveformData.sample_rate;
    const clipRate = clip.sampleRate;
    let peakOffset = clip.offsetSamples;
    let peakDuration = clip.durationSamples;
    let peakSpp = samplesPerPixel;
    if (wdRate !== clipRate && clipRate > 0 && wdRate > 0) {
      const ratio = wdRate / clipRate;
      peakOffset = Math.round(clip.offsetSamples * ratio);
      peakDuration = Math.round(clip.durationSamples * ratio);
      peakSpp = Math.max(1, Math.round(samplesPerPixel * ratio));
    }
    return extractPeaksFromWaveformDataFull(waveformData, peakSpp, mono, peakOffset, peakDuration);
  } catch (err) {
    console.warn('[waveform-playlist] Failed to extract peaks from waveformData: ' + String(err));
    return undefined;
  }
}

function extractFromGenerated(
  clip: AudioClip,
  generated: WaveformData,
  samplesPerPixel: number,
  mono: boolean
): PeakData | undefined {
  try {
    return extractPeaksFromWaveformDataFull(
      generated,
      samplesPerPixel,
      mono,
      clip.offsetSamples,
      clip.durationSamples
    );
  } catch (err) {
    console.warn('[waveform-playlist] Failed to extract peaks from cache: ' + String(err));
    return undefined;
  }
}

function emptyPeaks(inputs: PeakInputs): PeakData {
  // MIDI clips: derive pixel width from sample duration so the clip renders at
  // the correct width instead of zero-width. Audio clips keep the buffer's
  // channel count so the track height does not shift when peaks arrive.
  const pixelLength = inputs.isMidi
    ? Math.ceil(inputs.durationSamples / inputs.samplesPerPixel)
    : 0;
  return {
    length: pixelLength,
    data: Array.from({ length: inputs.fallbackChannels }, () => new Int16Array(pixelLength * 2)),
    bits: 16,
  };
}

function sameInputs(a: PeakInputs, b: PeakInputs, usesGenerated: boolean): boolean {
  return (
    a.waveformData === b.waveformData &&
    (!usesGenerated || a.generated === b.generated) &&
    a.offsetSamples === b.offsetSamples &&
    a.durationSamples === b.durationSamples &&
    a.sampleRate === b.sampleRate &&
    a.samplesPerPixel === b.samplesPerPixel &&
    a.mono === b.mono &&
    a.fallbackChannels === b.fallbackChannels &&
    a.isMidi === b.isMidi
  );
}

function computePeaks(
  clip: AudioClip,
  inputs: PeakInputs
): { peaks: PeakData; usesGenerated: boolean } {
  const { waveformData, generated, samplesPerPixel, mono } = inputs;
  const own = waveformData
    ? extractFromOwnWaveformData(clip, waveformData, samplesPerPixel, mono)
    : undefined;
  if (own) return { peaks: own, usesGenerated: false };

  const fromWorker = generated
    ? extractFromGenerated(clip, generated, samplesPerPixel, mono)
    : undefined;
  return { peaks: fromWorker ?? emptyPeaks(inputs), usesGenerated: true };
}

const NO_PLACEHOLDERS: ReadonlySet<string> = new Set();

function sameClipPeaks(
  a: ClipPeaks,
  clip: AudioClip,
  trackName: string,
  peaks: PeakData,
  isPlaceholder: boolean
): boolean {
  return (
    a.peaks === peaks &&
    a.isPlaceholder === isPlaceholder &&
    a.trackName === trackName &&
    a.startSample === clip.startSample &&
    a.durationSamples === clip.durationSamples &&
    a.fadeIn === clip.fadeIn &&
    a.fadeOut === clip.fadeOut &&
    a.midiNotes === clip.midiNotes &&
    a.sampleRate === clip.sampleRate &&
    a.offsetSamples === clip.offsetSamples &&
    a.gain === clip.gain
  );
}

function deriveClip(
  clip: AudioClip,
  trackName: string,
  isPlaceholder: boolean,
  options: DerivePeaksOptions,
  previous: ClipEntry | undefined
): ClipEntry {
  const inputs: PeakInputs = {
    waveformData: clip.waveformData as WaveformData | undefined,
    generated: clip.audioBuffer ? options.getGeneratedWaveformData(clip.audioBuffer) : undefined,
    offsetSamples: clip.offsetSamples,
    durationSamples: clip.durationSamples,
    sampleRate: clip.sampleRate,
    samplesPerPixel: options.samplesPerPixel,
    mono: options.mono,
    fallbackChannels: options.mono ? 1 : (clip.audioBuffer?.numberOfChannels ?? 1),
    isMidi: Boolean(clip.midiNotes),
  };

  const reusable = previous && sameInputs(previous.inputs, inputs, previous.usesGenerated);
  const { peaks, usesGenerated } = reusable
    ? { peaks: previous.peaks, usesGenerated: previous.usesGenerated }
    : computePeaks(clip, inputs);

  if (
    previous &&
    reusable &&
    sameClipPeaks(previous.clipPeaks, clip, trackName, peaks, isPlaceholder)
  ) {
    return previous;
  }

  return {
    inputs,
    usesGenerated,
    peaks,
    clipPeaks: {
      clipId: clip.id,
      trackName,
      peaks,
      startSample: clip.startSample,
      durationSamples: clip.durationSamples,
      fadeIn: clip.fadeIn,
      fadeOut: clip.fadeOut,
      midiNotes: clip.midiNotes,
      sampleRate: clip.sampleRate,
      offsetSamples: clip.offsetSamples,
      gain: clip.gain,
      isPlaceholder,
    },
  };
}

function sameItems<T>(a: readonly T[] | undefined, b: readonly T[]): a is T[] {
  return a !== undefined && a.length === b.length && a.every((item, i) => item === b[i]);
}

export function derivePeaks(
  tracks: ClipTrack[],
  options: DerivePeaksOptions,
  previous: PeaksCache,
  placeholderIds: ReadonlySet<string> = NO_PLACEHOLDERS
): PeaksCache {
  const clips = new Map<string, ClipEntry>();
  const trackPeaks = new Map<string, TrackClipPeaks>();

  const derived = tracks.map((track) => {
    const clipPeaks = track.clips.map((clip) => {
      const entry = deriveClip(
        clip,
        track.name,
        placeholderIds.has(clip.id),
        options,
        previous.clips.get(clip.id)
      );
      clips.set(clip.id, entry);
      return entry.clipPeaks;
    });
    const before = previous.tracks.get(track.id);
    const stable = sameItems(before, clipPeaks) ? before : clipPeaks;
    trackPeaks.set(track.id, stable);
    return stable;
  });

  return {
    clips,
    tracks: trackPeaks,
    result: sameItems(previous.result, derived) ? previous.result : derived,
  };
}
