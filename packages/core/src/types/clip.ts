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
 * Represents a single audio clip on the timeline
 */
export interface AudioClip {
  /** Unique identifier for this clip */
  id: string;

  /** The audio buffer containing the audio data */
  audioBuffer: AudioBuffer;

  /** Position on timeline where this clip starts (seconds) */
  startTime: number;

  /** Duration of this clip (seconds) - how much of the audio buffer to play */
  duration: number;

  /** Offset into the audio buffer where playback starts (seconds) - the "trim start" point */
  offset: number;

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
  effects?: any; // TrackEffectsFunction - typed as any to avoid circular dependency
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
 * Options for creating a new audio clip
 */
export interface CreateClipOptions {
  audioBuffer: AudioBuffer;
  startTime: number;
  duration?: number;      // Defaults to full buffer duration
  offset?: number;        // Defaults to 0
  gain?: number;          // Defaults to 1.0
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
 * Creates a new AudioClip with sensible defaults
 */
export function createClip(options: CreateClipOptions): AudioClip {
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

  return {
    id: generateId(),
    audioBuffer,
    startTime,
    duration,
    offset,
    gain,
    name,
    color,
    fadeIn,
    fadeOut,
  };
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
  // Calculate total duration from all clips across all tracks
  const duration = tracks.reduce((maxDuration, track) => {
    const trackDuration = track.clips.reduce((max, clip) => {
      return Math.max(max, clip.startTime + clip.duration);
    }, 0);
    return Math.max(maxDuration, trackDuration);
  }, 0);

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
 * Utility: Get all clips within a time range
 */
export function getClipsInRange(
  track: ClipTrack,
  startTime: number,
  endTime: number
): AudioClip[] {
  return track.clips.filter((clip) => {
    const clipEnd = clip.startTime + clip.duration;
    // Clip overlaps with range if:
    // - Clip starts before range ends AND
    // - Clip ends after range starts
    return clip.startTime < endTime && clipEnd > startTime;
  });
}

/**
 * Utility: Get all clips at a specific time position
 */
export function getClipsAtTime(track: ClipTrack, time: number): AudioClip[] {
  return track.clips.filter((clip) => {
    const clipEnd = clip.startTime + clip.duration;
    return time >= clip.startTime && time < clipEnd;
  });
}

/**
 * Utility: Check if two clips overlap
 */
export function clipsOverlap(clip1: AudioClip, clip2: AudioClip): boolean {
  const clip1End = clip1.startTime + clip1.duration;
  const clip2End = clip2.startTime + clip2.duration;

  return clip1.startTime < clip2End && clip1End > clip2.startTime;
}

/**
 * Utility: Sort clips by startTime
 */
export function sortClipsByTime(clips: AudioClip[]): AudioClip[] {
  return [...clips].sort((a, b) => a.startTime - b.startTime);
}

/**
 * Utility: Find gaps between clips (silent regions)
 */
export interface Gap {
  startTime: number;
  endTime: number;
  duration: number;
}

export function findGaps(track: ClipTrack): Gap[] {
  if (track.clips.length === 0) return [];

  const sorted = sortClipsByTime(track.clips);
  const gaps: Gap[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const currentClipEnd = sorted[i].startTime + sorted[i].duration;
    const nextClipStart = sorted[i + 1].startTime;

    if (nextClipStart > currentClipEnd) {
      gaps.push({
        startTime: currentClipEnd,
        endTime: nextClipStart,
        duration: nextClipStart - currentClipEnd,
      });
    }
  }

  return gaps;
}
