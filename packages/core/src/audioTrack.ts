import type { Fade } from './types';
import type { RenderMode, SpectrogramConfig, ColorMapValue } from './types/spectrogram';
import { createClipFromSeconds, createTrack } from './types/clip';
import type {
  AudioClip,
  ClipSource,
  LoadingClip,
  PlaylistTrack,
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
  /** Audio already in memory. With `src` too, the clip is built loaded and nothing is fetched. */
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

function defaultName(src: ClipSource | undefined): string {
  const raw =
    typeof src === 'string'
      ? src
      : typeof File !== 'undefined' && src instanceof File
        ? src.name
        : '';
  const path = raw.split(/[?#]/)[0];
  const file = path.slice(path.lastIndexOf('/') + 1);
  const dot = file.lastIndexOf('.');
  const base = dot > 0 ? file.slice(0, dot) : file;
  return base || 'Untitled';
}

function checkAgainstAudio(
  offset: number,
  duration: number | undefined,
  sourceSeconds: number
): void {
  if (offset >= sourceSeconds) {
    throw new Error('audioTrack: offset is past the end of the audio');
  }
  if (duration !== undefined && offset + duration > sourceSeconds) {
    throw new Error('audioTrack: offset + duration is longer than the audio');
  }
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
  const sourceSeconds = audioBuffer?.duration ?? waveformData?.duration ?? 0;
  checkAgainstAudio(offset, duration, sourceSeconds);
  const clip = createClipFromSeconds({
    audioBuffer,
    waveformData,
    startTime: start,
    offset,
    duration: duration ?? sourceSeconds - offset,
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
 * Builds a track whose one clip names its audio. With `src` the clip is a
 * loading clip the provider loads; with `audioBuffer` or `waveformData` it is
 * an `AudioClip` built now.
 */
export function audioTrack(options: AudioTrackOptions): PlaylistTrack {
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
  const track: PlaylistTrack = {
    ...base,
    id: options.id || base.id,
    clips: [clip],
    renderMode: options.renderMode,
  };
  return track;
}
