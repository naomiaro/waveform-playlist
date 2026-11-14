import type { Fade } from './types';
import type { RenderMode, SpectrogramConfig, ColorMapValue } from './types/spectrogram';
import { createClipFromSeconds, createTrack } from './types/clip';
import type {
  AudioClip,
  ClipSource,
  LoadingClip,
  ArrangementTrack,
  WaveformDataObject,
} from './types/clip';

export interface AudioTrackOptions {
  /** Track id. Default: generated. An empty string counts as none. */
  id?: string;
  /** Id of the clip. Default: generated. An empty string counts as none. */
  clipId?: string;
  /** Track name. Default: the file name of `src` without its extension, else 'Untitled'. */
  name?: string;
  /** The audio to load. A string is a URL; a Blob or File is keyed by identity. */
  src?: ClipSource;
  /** Audio already in memory. With `src` too, the clip is an `AudioClip` that records `src`. */
  audioBuffer?: AudioBuffer;
  /** Pre-computed peaks. Without `src` or `audioBuffer`, the clip is built from these alone. */
  waveformData?: WaveformDataObject;
  /** Position on the timeline, in seconds. Default 0. */
  start?: number;
  /** Duration in seconds. Default: the whole source from `offset`. */
  duration?: number;
  /** Start within the source, in seconds. Default 0. */
  offset?: number;
  fadeIn?: Fade;
  fadeOut?: Fade;
  /** Clip gain. Default 1. */
  gain?: number;
  color?: string;
  muted?: boolean;
  soloed?: boolean;
  volume?: number;
  pan?: number;
  renderMode?: RenderMode;
  spectrogramConfig?: SpectrogramConfig;
  spectrogramColorMap?: ColorMapValue;
}

// A copy of the private generateId in types/clip.ts (same id format).
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function checkNonNegative(name: string, value: number | undefined): void {
  if (value !== undefined && !(Number.isFinite(value) && value >= 0)) {
    throw new Error(`audioTrack: ${name} must be a finite number of seconds, 0 or more`);
  }
}

function checkOptions(options: AudioTrackOptions): void {
  checkNonNegative('start', options.start);
  checkNonNegative('offset', options.offset);
  const { duration } = options;
  if (duration !== undefined && !(Number.isFinite(duration) && duration > 0)) {
    throw new Error('audioTrack: duration must be a positive finite number of seconds');
  }
}

function decodeName(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name; // a malformed sequence keeps the raw name
  }
}

function defaultName(src: ClipSource | undefined): string {
  const raw =
    typeof src === 'string'
      ? src
      : typeof File !== 'undefined' && src instanceof File
        ? src.name
        : '';
  if (/^(data|blob):/i.test(raw)) return 'Untitled';
  const path = raw.split(/[?#]/)[0];
  const file = path.slice(path.lastIndexOf('/') + 1);
  const dot = file.lastIndexOf('.');
  const base = dot > 0 ? file.slice(0, dot) : file;
  return decodeName(base) || 'Untitled';
}

/**
 * Duration in seconds to build the clip with. An offset at or past the end of
 * the audio throws; a duration that runs past the end is cut to it, with a
 * warning. Compared in samples, with a tolerance of one sample.
 */
function fitToAudio(
  name: string,
  offset: number,
  duration: number | undefined,
  sampleRate: number,
  sourceSamples: number
): number {
  const offsetSamples = Math.round(offset * sampleRate);
  if (offsetSamples >= sourceSamples) {
    throw new Error('audioTrack: offset is past the end of the audio');
  }
  const remaining = sourceSamples - offsetSamples;
  if (duration === undefined) return remaining / sampleRate;
  const wanted = Math.round(duration * sampleRate);
  if (offsetSamples + wanted > sourceSamples + 1) {
    console.warn(
      `[waveform-playlist] audioTrack: offset + duration of "${name}" runs past the end of the audio; the clip is cut to the end.`
    );
  }
  return Math.min(wanted, remaining) / sampleRate;
}

function buildLoadingClip(
  id: string,
  src: ClipSource,
  name: string,
  options: AudioTrackOptions
): LoadingClip {
  const given = {
    start: options.start,
    duration: options.duration,
    offset: options.offset,
    gain: options.gain,
    fadeIn: options.fadeIn,
    fadeOut: options.fadeOut,
    color: options.color,
    waveformData: options.waveformData,
  };
  const present = Object.entries(given).filter(([, value]) => value !== undefined);
  return { id, src, name, ...Object.fromEntries(present) };
}

function buildClip(options: AudioTrackOptions, name: string): AudioClip | LoadingClip {
  const { audioBuffer, waveformData, start = 0, offset = 0, duration } = options;
  const src = options.src || undefined; // '' counts as none
  const id = options.clipId || generateId();
  if (src !== undefined && !audioBuffer) return buildLoadingClip(id, src, name, options);
  if (!audioBuffer && !waveformData) {
    throw new Error('audioTrack: give src, audioBuffer or waveformData');
  }
  // The length of the audio in samples: the buffer's own length, or the
  // waveform data's duration rounded up, as createClipFromSeconds rounds it.
  const sampleRate = audioBuffer?.sampleRate ?? waveformData?.sample_rate ?? 0;
  const sourceSamples =
    audioBuffer?.length ?? Math.ceil((waveformData?.duration ?? 0) * sampleRate);
  const clipSeconds = fitToAudio(name, offset, duration, sampleRate, sourceSamples);
  const clip = createClipFromSeconds({
    audioBuffer,
    waveformData,
    startTime: start,
    offset,
    duration: clipSeconds,
    name,
    gain: options.gain,
    fadeIn: options.fadeIn,
    fadeOut: options.fadeOut,
    color: options.color,
    src,
  });
  return { ...clip, id };
}

/**
 * Builds a track whose one clip names its audio. With `src` and no
 * `audioBuffer` the clip is a `LoadingClip` (audio not loaded yet); with
 * `audioBuffer`, or `waveformData` and no `src`, it is an `AudioClip` built now.
 * A duration that runs past the end of the audio is cut to it, with a warning.
 */
export function audioTrack(options: AudioTrackOptions): ArrangementTrack {
  checkOptions(options);
  const name = options.name ?? defaultName(options.src);
  const clip = buildClip(options, name);
  const base = createTrack({
    name,
    muted: options.muted,
    soloed: options.soloed,
    volume: options.volume,
    pan: options.pan,
    spectrogramConfig: options.spectrogramConfig,
    spectrogramColorMap: options.spectrogramColorMap,
    color: options.color,
  });
  const track: ArrangementTrack = {
    ...base,
    id: options.id || base.id,
    clips: [clip],
    renderMode: options.renderMode,
  };
  return track;
}
