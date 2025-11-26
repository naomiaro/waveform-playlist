/**
 * Clip-Based Model Types
 *
 * These types support a professional multi-track editing model where:
 * - Each track can contain multiple audio clips
 * - Clips can be positioned anywhere on the timeline
 * - Clips have independent trim points (offset/duration)
 * - Gaps between clips are silent
 * - Clips can overlap (for crossfades)
 */

import { Fade } from './index';

/**
 * Generic effects function type for track-level audio processing.
 *
 * The actual implementation receives Tone.js audio nodes. Using generic types
 * here to avoid circular dependencies with the playout package.
 *
 * @param graphEnd - The end of the track's audio graph (Tone.js Gain node)
 * @param destination - Where to connect the effects output (Tone.js ToneAudioNode)
 * @param isOffline - Whether rendering offline (for export)
 * @returns Optional cleanup function called when track is disposed
 *
 * @example
 * ```typescript
 * const trackEffects: TrackEffectsFunction = (graphEnd, destination, isOffline) => {
 *   const reverb = new Tone.Reverb({ decay: 1.5 });
 *   graphEnd.connect(reverb);
 *   reverb.connect(destination);
 *
 *   return () => {
 *     reverb.dispose();
 *   };
 * };
 * ```
 */
export type TrackEffectsFunction = (
  graphEnd: unknown,
  destination: unknown,
  isOffline: boolean
) => void | (() => void);

/**
 * Represents a single audio clip on the timeline
 *
 * IMPORTANT: All positions/durations are stored as SAMPLE COUNTS (integers)
 * to avoid floating-point precision errors. Convert to seconds only when
 * needed for playback using: seconds = samples / sampleRate
 */
export interface AudioClip {
  /** Unique identifier for this clip */
  id: string;

  /** The audio buffer containing the audio data */
  audioBuffer: AudioBuffer;

  /** Position on timeline where this clip starts (in samples at timeline sampleRate) */
  startSample: number;

  /** Duration of this clip (in samples) - how much of the audio buffer to play */
  durationSamples: number;

  /** Offset into the audio buffer where playback starts (in samples) - the "trim start" point */
  offsetSamples: number;

  /** Optional fade in effect */
  fadeIn?: Fade;

  /** Optional fade out effect */
  fadeOut?: Fade;

  /** Clip-specific gain/volume multiplier (0.0 to 1.0+) */
  gain: number;

  /** Optional label/name for this clip */
  name?: string;

  /** Optional color for visual distinction */
  color?: string;
}

/**
 * Represents a track containing multiple audio clips
 */
export interface ClipTrack {
  /** Unique identifier for this track */
  id: string;

  /** Display name for this track */
  name: string;

  /** Array of audio clips on this track */
  clips: AudioClip[];

  /** Whether this track is muted */
  muted: boolean;

  /** Whether this track is soloed */
  soloed: boolean;

  /** Track volume (0.0 to 1.0+) */
  volume: number;

  /** Stereo pan (-1.0 = left, 0 = center, 1.0 = right) */
  pan: number;

  /** Optional track color for visual distinction */
  color?: string;

  /** Track height in pixels (for UI) */
  height?: number;

  /** Optional effects function for this track */
  effects?: TrackEffectsFunction;
}

/**
 * Represents the entire timeline/project
 */
export interface Timeline {
  /** All tracks in the timeline */
  tracks: ClipTrack[];

  /** Total timeline duration in seconds */
  duration: number;

  /** Sample rate for all audio (typically 44100 or 48000) */
  sampleRate: number;

  /** Optional project name */
  name?: string;

  /** Optional tempo (BPM) for grid snapping */
  tempo?: number;

  /** Optional time signature for grid snapping */
  timeSignature?: {
    numerator: number;
    denominator: number;
  };
}

/**
 * Options for creating a new audio clip (using sample counts)
 */
export interface CreateClipOptions {
  audioBuffer: AudioBuffer;
  startSample: number;           // Position on timeline (in samples)
  durationSamples?: number;      // Defaults to full buffer duration (in samples)
  offsetSamples?: number;        // Defaults to 0
  gain?: number;                 // Defaults to 1.0
  name?: string;
  color?: string;
  fadeIn?: Fade;
  fadeOut?: Fade;
}

/**
 * Options for creating a new audio clip (using seconds for convenience)
 */
export interface CreateClipOptionsSeconds {
  audioBuffer: AudioBuffer;
  startTime: number;        // Position on timeline (in seconds)
  duration?: number;        // Defaults to full buffer duration (in seconds)
  offset?: number;          // Defaults to 0 (in seconds)
  gain?: number;            // Defaults to 1.0
  name?: string;
  color?: string;
  fadeIn?: Fade;
  fadeOut?: Fade;
}

/**
 * Options for creating a new track
 */
export interface CreateTrackOptions {
  name: string;
  clips?: AudioClip[];
  muted?: boolean;
  soloed?: boolean;
  volume?: number;
  pan?: number;
  color?: string;
  height?: number;
}

/**
 * Creates a new AudioClip with sensible defaults (using sample counts)
 */
export function createClip(options: CreateClipOptions): AudioClip {
  const {
    audioBuffer,
    startSample,
    durationSamples = audioBuffer.length, // Full buffer by default
    offsetSamples = 0,
    gain = 1.0,
    name,
    color,
    fadeIn,
    fadeOut,
  } = options;

  return {
    id: generateId(),
    audioBuffer,
    startSample,
    durationSamples,
    offsetSamples,
    gain,
    name,
    color,
    fadeIn,
    fadeOut,
  };
}

/**
 * Creates a new AudioClip from time-based values (convenience function)
 * Converts seconds to samples using the audioBuffer's sampleRate
 */
export function createClipFromSeconds(options: CreateClipOptionsSeconds): AudioClip {
  const {
    audioBuffer,
    startTime,
    duration = audioBuffer.duration,
    offset = 0,
    gain = 1.0,
    name,
    color,
    fadeIn,
    fadeOut,
  } = options;

  const sampleRate = audioBuffer.sampleRate;

  return createClip({
    audioBuffer,
    startSample: Math.round(startTime * sampleRate),
    durationSamples: Math.round(duration * sampleRate),
    offsetSamples: Math.round(offset * sampleRate),
    gain,
    name,
    color,
    fadeIn,
    fadeOut,
  });
}

/**
 * Creates a new ClipTrack with sensible defaults
 */
export function createTrack(options: CreateTrackOptions): ClipTrack {
  const {
    name,
    clips = [],
    muted = false,
    soloed = false,
    volume = 1.0,
    pan = 0,
    color,
    height,
  } = options;

  return {
    id: generateId(),
    name,
    clips,
    muted,
    soloed,
    volume,
    pan,
    color,
    height,
  };
}

/**
 * Creates a new Timeline with sensible defaults
 */
export function createTimeline(
  tracks: ClipTrack[],
  sampleRate: number = 44100,
  options?: {
    name?: string;
    tempo?: number;
    timeSignature?: { numerator: number; denominator: number };
  }
): Timeline {
  // Calculate total duration from all clips across all tracks (in seconds)
  const durationSamples = tracks.reduce((maxSamples, track) => {
    const trackSamples = track.clips.reduce((max, clip) => {
      return Math.max(max, clip.startSample + clip.durationSamples);
    }, 0);
    return Math.max(maxSamples, trackSamples);
  }, 0);

  const duration = durationSamples / sampleRate;

  return {
    tracks,
    duration,
    sampleRate,
    name: options?.name,
    tempo: options?.tempo,
    timeSignature: options?.timeSignature,
  };
}

/**
 * Generates a unique ID for clips and tracks
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Utility: Get all clips within a sample range
 */
export function getClipsInRange(
  track: ClipTrack,
  startSample: number,
  endSample: number
): AudioClip[] {
  return track.clips.filter((clip) => {
    const clipEnd = clip.startSample + clip.durationSamples;
    // Clip overlaps with range if:
    // - Clip starts before range ends AND
    // - Clip ends after range starts
    return clip.startSample < endSample && clipEnd > startSample;
  });
}

/**
 * Utility: Get all clips at a specific sample position
 */
export function getClipsAtSample(track: ClipTrack, sample: number): AudioClip[] {
  return track.clips.filter((clip) => {
    const clipEnd = clip.startSample + clip.durationSamples;
    return sample >= clip.startSample && sample < clipEnd;
  });
}

/**
 * Utility: Check if two clips overlap
 */
export function clipsOverlap(clip1: AudioClip, clip2: AudioClip): boolean {
  const clip1End = clip1.startSample + clip1.durationSamples;
  const clip2End = clip2.startSample + clip2.durationSamples;

  return clip1.startSample < clip2End && clip1End > clip2.startSample;
}

/**
 * Utility: Sort clips by startSample
 */
export function sortClipsByTime(clips: AudioClip[]): AudioClip[] {
  return [...clips].sort((a, b) => a.startSample - b.startSample);
}

/**
 * Utility: Find gaps between clips (silent regions)
 */
export interface Gap {
  startSample: number;
  endSample: number;
  durationSamples: number;
}

export function findGaps(track: ClipTrack): Gap[] {
  if (track.clips.length === 0) return [];

  const sorted = sortClipsByTime(track.clips);
  const gaps: Gap[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const currentClipEnd = sorted[i].startSample + sorted[i].durationSamples;
    const nextClipStart = sorted[i + 1].startSample;

    if (nextClipStart > currentClipEnd) {
      gaps.push({
        startSample: currentClipEnd,
        endSample: nextClipStart,
        durationSamples: nextClipStart - currentClipEnd,
      });
    }
  }

  return gaps;
}
