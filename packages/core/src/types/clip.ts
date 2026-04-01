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
import type { RenderMode, SpectrogramConfig, ColorMapValue } from './spectrogram';

/**
 * WaveformData object from waveform-data.js library.
 * Supports resample() and slice() for dynamic zoom levels.
 * See: https://github.com/bbc/waveform-data.js
 */
export interface WaveformDataObject {
  /** Sample rate of the original audio */
  readonly sample_rate: number;
  /** Number of audio samples per pixel */
  readonly scale: number;
  /** Length of waveform data in pixels */
  readonly length: number;
  /** Bit depth (8 or 16) */
  readonly bits: number;
  /** Duration in seconds */
  readonly duration: number;
  /** Number of channels */
  readonly channels: number;
  /** Get channel data */
  channel: (index: number) => {
    min_array: () => number[];
    max_array: () => number[];
  };
  /** Resample to different scale */
  resample: (options: { scale: number } | { width: number }) => WaveformDataObject;
  /** Slice a portion of the waveform */
  slice: (
    options: { startTime: number; endTime: number } | { startIndex: number; endIndex: number }
  ) => WaveformDataObject;
}

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
 *
 * Clips can be created with just waveformData (for instant visual rendering)
 * and have audioBuffer added later when audio finishes loading.
 */
export interface AudioClip {
  /** Unique identifier for this clip */
  id: string;

  /**
   * The audio buffer containing the audio data.
   * Optional for peaks-first rendering - can be added later.
   * Required for playback and editing operations.
   */
  audioBuffer?: AudioBuffer;

  /** Position on timeline where this clip starts (in samples at timeline sampleRate) */
  startSample: number;

  /**
   * Position on timeline in ticks (authoritative when present).
   * When set, startSample is a derived cache recomputed from startTick via TempoMap.
   * Optional for backwards compatibility — engine enriches clips without startTick on ingestion.
   */
  startTick?: number;

  /** Duration of this clip (in samples) - how much of the audio buffer to play */
  durationSamples: number;

  /** Offset into the audio buffer where playback starts (in samples) - the "trim start" point */
  offsetSamples: number;

  /**
   * Sample rate for this clip's audio.
   * Required when audioBuffer is not provided (for peaks-first rendering).
   * When audioBuffer is present, this should match audioBuffer.sampleRate.
   */
  sampleRate: number;

  /**
   * Total duration of the source audio in samples.
   * Required when audioBuffer is not provided (for trim bounds calculation).
   * When audioBuffer is present, this should equal audioBuffer.length.
   */
  sourceDurationSamples: number;

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

  /**
   * Pre-computed waveform data from waveform-data.js library.
   * When provided, the library will use this instead of computing peaks from the audioBuffer.
   * Supports resampling to different zoom levels and slicing for clip trimming.
   * Load with: `const waveformData = await loadWaveformData('/path/to/peaks.dat')`
   */
  waveformData?: WaveformDataObject;

  /**
   * MIDI note data — when present, this clip plays MIDI instead of audio.
   * The playout adapter uses this field to detect MIDI clips and route them
   * to MidiToneTrack (PolySynth) instead of ToneTrack (AudioBufferSourceNode).
   */
  midiNotes?: MidiNoteData[];

  /** MIDI channel (0-indexed). Channel 9 = GM percussion. */
  midiChannel?: number;

  /** MIDI program number (0-127). GM instrument number for SoundFont playback. */
  midiProgram?: number;
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

  /** Visualization render mode. Default: 'waveform' */
  renderMode?: RenderMode;

  /** Per-track spectrogram configuration (FFT size, window, frequency scale, etc.) */
  spectrogramConfig?: SpectrogramConfig;

  /** Per-track spectrogram color map name or custom color array */
  spectrogramColorMap?: ColorMapValue;
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
 *
 * Either audioBuffer OR (sampleRate + sourceDurationSamples + waveformData) must be provided.
 * Providing waveformData without audioBuffer enables peaks-first rendering.
 */
export interface CreateClipOptions {
  /** Audio buffer - optional for peaks-first rendering */
  audioBuffer?: AudioBuffer;
  startSample: number; // Position on timeline (in samples)
  startTick?: number; // Timeline position in ticks (optional)
  durationSamples?: number; // Defaults to full buffer/source duration (in samples)
  offsetSamples?: number; // Defaults to 0
  gain?: number; // Defaults to 1.0
  name?: string;
  color?: string;
  fadeIn?: Fade;
  fadeOut?: Fade;
  /** Pre-computed waveform data from waveform-data.js (e.g., from BBC audiowaveform) */
  waveformData?: WaveformDataObject;
  /** Sample rate - required if audioBuffer not provided */
  sampleRate?: number;
  /** Total source audio duration in samples - required if audioBuffer not provided */
  sourceDurationSamples?: number;
  /** MIDI note data — passed through to the created AudioClip */
  midiNotes?: MidiNoteData[];
  /** MIDI channel (0-indexed). Channel 9 = GM percussion. */
  midiChannel?: number;
  /** MIDI program number (0-127). GM instrument for SoundFont playback. */
  midiProgram?: number;
}

/**
 * Options for creating a new audio clip (using seconds for convenience)
 *
 * Either audioBuffer OR (sampleRate + sourceDuration + waveformData) must be provided.
 * Providing waveformData without audioBuffer enables peaks-first rendering.
 */
export interface CreateClipOptionsSeconds {
  /** Audio buffer - optional for peaks-first rendering */
  audioBuffer?: AudioBuffer;
  startTime: number; // Position on timeline (in seconds)
  startTick?: number; // Timeline position in ticks (optional)
  duration?: number; // Defaults to full buffer/source duration (in seconds)
  offset?: number; // Defaults to 0 (in seconds)
  gain?: number; // Defaults to 1.0
  name?: string;
  color?: string;
  fadeIn?: Fade;
  fadeOut?: Fade;
  /** Pre-computed waveform data from waveform-data.js (e.g., from BBC audiowaveform) */
  waveformData?: WaveformDataObject;
  /** Sample rate - required if audioBuffer not provided */
  sampleRate?: number;
  /** Total source audio duration in seconds - required if audioBuffer not provided */
  sourceDuration?: number;
  /** MIDI note data — passed through to the created AudioClip */
  midiNotes?: MidiNoteData[];
  /** MIDI channel (0-indexed). Channel 9 = GM percussion. */
  midiChannel?: number;
  /** MIDI program number (0-127). GM instrument for SoundFont playback. */
  midiProgram?: number;
}

/**
 * Options for creating a new audio clip from tick position.
 * startTick is authoritative; startSample is derived.
 *
 * Provide either:
 * - ticksToSeconds callback (for variable-tempo / multi-tempo), or
 * - bpm + ppqn (for single-tempo convenience)
 */
export interface CreateClipOptionsTicks {
  startTick: number;
  ticksToSeconds?: (tick: number) => number;
  bpm?: number;
  ppqn?: number;
  audioBuffer?: AudioBuffer;
  durationSamples?: number;
  offsetSamples?: number;
  gain?: number;
  name?: string;
  color?: string;
  fadeIn?: Fade;
  fadeOut?: Fade;
  waveformData?: WaveformDataObject;
  sampleRate?: number;
  sourceDurationSamples?: number;
  midiNotes?: MidiNoteData[];
  midiChannel?: number;
  midiProgram?: number;
}

export function createClipFromTicks(options: CreateClipOptionsTicks): AudioClip {
  const { startTick, ticksToSeconds, bpm, ppqn } = options;

  if (startTick < 0) {
    throw new Error('createClipFromTicks: startTick must be non-negative');
  }

  let toSeconds: (tick: number) => number;
  if (ticksToSeconds) {
    toSeconds = ticksToSeconds;
  } else if (bpm !== undefined && ppqn !== undefined) {
    toSeconds = (tick: number) => (tick * 60) / (ppqn * bpm);
  } else {
    throw new Error(
      'createClipFromTicks: either ticksToSeconds callback or both bpm and ppqn are required'
    );
  }

  const sampleRate =
    options.audioBuffer?.sampleRate ?? options.sampleRate ?? options.waveformData?.sample_rate;
  if (sampleRate === undefined) {
    throw new Error('createClipFromTicks: sampleRate is required when audioBuffer is not provided');
  }

  const startSample = Math.round(toSeconds(startTick) * sampleRate);

  return createClip({
    audioBuffer: options.audioBuffer,
    startSample,
    startTick,
    durationSamples: options.durationSamples,
    offsetSamples: options.offsetSamples,
    gain: options.gain,
    name: options.name,
    color: options.color,
    fadeIn: options.fadeIn,
    fadeOut: options.fadeOut,
    waveformData: options.waveformData,
    sampleRate: options.sampleRate,
    sourceDurationSamples: options.sourceDurationSamples,
    midiNotes: options.midiNotes,
    midiChannel: options.midiChannel,
    midiProgram: options.midiProgram,
  });
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
  spectrogramConfig?: SpectrogramConfig;
  spectrogramColorMap?: ColorMapValue;
}

/**
 * Creates a new AudioClip with sensible defaults (using sample counts)
 *
 * For peaks-first rendering (no audioBuffer), sampleRate and sourceDurationSamples can be:
 * - Provided explicitly via options
 * - Derived from waveformData (sample_rate and duration properties)
 */
export function createClip(options: CreateClipOptions): AudioClip {
  const {
    audioBuffer,
    startSample,
    startTick,
    offsetSamples = 0,
    gain = 1.0,
    name,
    color,
    fadeIn,
    fadeOut,
    waveformData,
    midiNotes,
    midiChannel,
    midiProgram,
  } = options;

  // Determine sample rate: audioBuffer > explicit option > waveformData
  const sampleRate = audioBuffer?.sampleRate ?? options.sampleRate ?? waveformData?.sample_rate;

  // Determine source duration: audioBuffer > explicit option > waveformData (converted to samples)
  const sourceDurationSamples =
    audioBuffer?.length ??
    options.sourceDurationSamples ??
    (waveformData && sampleRate ? Math.ceil(waveformData.duration * sampleRate) : undefined);

  if (sampleRate === undefined) {
    throw new Error(
      'createClip: sampleRate is required when audioBuffer is not provided (can use waveformData.sample_rate)'
    );
  }
  if (sourceDurationSamples === undefined) {
    throw new Error(
      'createClip: sourceDurationSamples is required when audioBuffer is not provided (can use waveformData.duration)'
    );
  }

  if (audioBuffer && waveformData && audioBuffer.sampleRate !== waveformData.sample_rate) {
    console.warn(
      '[waveform-playlist] "' +
        (name ?? 'unnamed') +
        '": pre-computed peaks at ' +
        waveformData.sample_rate +
        ' Hz do not match decoded audio at ' +
        audioBuffer.sampleRate +
        ' Hz — peaks may be recomputed from decoded audio'
    );
  }

  // Default duration to full source duration
  const durationSamples = options.durationSamples ?? sourceDurationSamples;

  return {
    id: generateId(),
    audioBuffer,
    startSample,
    startTick,
    durationSamples,
    offsetSamples,
    sampleRate,
    sourceDurationSamples,
    gain,
    name,
    color,
    fadeIn,
    fadeOut,
    waveformData,
    midiNotes,
    midiChannel,
    midiProgram,
  };
}

/**
 * Creates a new AudioClip from time-based values (convenience function)
 * Converts seconds to samples using the audioBuffer's sampleRate or explicit sampleRate
 *
 * For peaks-first rendering (no audioBuffer), sampleRate and sourceDuration can be:
 * - Provided explicitly via options
 * - Derived from waveformData (sample_rate and duration properties)
 */
export function createClipFromSeconds(options: CreateClipOptionsSeconds): AudioClip {
  const {
    audioBuffer,
    startTime,
    offset = 0,
    gain = 1.0,
    name,
    color,
    fadeIn,
    fadeOut,
    waveformData,
    midiNotes,
    midiChannel,
    midiProgram,
  } = options;

  // Determine sample rate: audioBuffer > explicit option > waveformData
  const sampleRate = audioBuffer?.sampleRate ?? options.sampleRate ?? waveformData?.sample_rate;
  if (sampleRate === undefined) {
    throw new Error(
      'createClipFromSeconds: sampleRate is required when audioBuffer is not provided (can use waveformData.sample_rate)'
    );
  }

  // Determine source duration: audioBuffer > explicit option > waveformData
  const sourceDuration = audioBuffer?.duration ?? options.sourceDuration ?? waveformData?.duration;
  if (sourceDuration === undefined) {
    throw new Error(
      'createClipFromSeconds: sourceDuration is required when audioBuffer is not provided (can use waveformData.duration)'
    );
  }

  // Note: audioBuffer and waveformData may have different sample rates (e.g., Opus at 48000
  // decoded on 44100 hardware). This is expected — callers fall back to worker to recompute peaks.

  // Default clip duration to full source duration
  const duration = options.duration ?? sourceDuration;

  return createClip({
    audioBuffer,
    startSample: Math.round(startTime * sampleRate),
    startTick: options.startTick,
    durationSamples: Math.round(duration * sampleRate),
    offsetSamples: Math.round(offset * sampleRate),
    sampleRate,
    sourceDurationSamples: Math.ceil(sourceDuration * sampleRate),
    gain,
    name,
    color,
    fadeIn,
    fadeOut,
    waveformData,
    midiNotes,
    midiChannel,
    midiProgram,
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
    spectrogramConfig,
    spectrogramColorMap,
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
    spectrogramConfig,
    spectrogramColorMap,
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
 * MIDI note data for clips that play MIDI instead of audio.
 * When present on an AudioClip, the clip is treated as a MIDI clip
 * by the playout adapter.
 */
export interface MidiNoteData {
  /** MIDI note number (0-127) */
  midi: number;
  /** Note name in scientific pitch notation ("C4", "G#3") */
  name: string;
  /** Start time in seconds, relative to clip start */
  time: number;
  /** Duration in seconds */
  duration: number;
  /** Velocity (0-1 normalized) */
  velocity: number;
  /** MIDI channel (0-indexed). Channel 9 = GM percussion. Enables per-note routing in flattened tracks. */
  channel?: number;
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
