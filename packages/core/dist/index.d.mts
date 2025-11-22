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

/**
 * Represents a single audio clip on the timeline
 */
interface AudioClip {
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
interface ClipTrack {
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
    effects?: any;
}
/**
 * Represents the entire timeline/project
 */
interface Timeline {
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
interface CreateClipOptions {
    audioBuffer: AudioBuffer;
    startTime: number;
    duration?: number;
    offset?: number;
    gain?: number;
    name?: string;
    color?: string;
    fadeIn?: Fade;
    fadeOut?: Fade;
}
/**
 * Options for creating a new track
 */
interface CreateTrackOptions {
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
declare function createClip(options: CreateClipOptions): AudioClip;
/**
 * Creates a new ClipTrack with sensible defaults
 */
declare function createTrack(options: CreateTrackOptions): ClipTrack;
/**
 * Creates a new Timeline with sensible defaults
 */
declare function createTimeline(tracks: ClipTrack[], sampleRate?: number, options?: {
    name?: string;
    tempo?: number;
    timeSignature?: {
        numerator: number;
        denominator: number;
    };
}): Timeline;
/**
 * Utility: Get all clips within a time range
 */
declare function getClipsInRange(track: ClipTrack, startTime: number, endTime: number): AudioClip[];
/**
 * Utility: Get all clips at a specific time position
 */
declare function getClipsAtTime(track: ClipTrack, time: number): AudioClip[];
/**
 * Utility: Check if two clips overlap
 */
declare function clipsOverlap(clip1: AudioClip, clip2: AudioClip): boolean;
/**
 * Utility: Sort clips by startTime
 */
declare function sortClipsByTime(clips: AudioClip[]): AudioClip[];
/**
 * Utility: Find gaps between clips (silent regions)
 */
interface Gap {
    startTime: number;
    endTime: number;
    duration: number;
}
declare function findGaps(track: ClipTrack): Gap[];

interface WaveformConfig {
    sampleRate: number;
    samplesPerPixel: number;
    waveHeight?: number;
    waveOutlineColor?: string;
    waveFillColor?: string;
    waveProgressColor?: string;
}
interface AudioBuffer$1 {
    length: number;
    duration: number;
    numberOfChannels: number;
    sampleRate: number;
    getChannelData(channel: number): Float32Array;
}
interface Track {
    id: string;
    name: string;
    src?: string | AudioBuffer$1;
    gain: number;
    muted: boolean;
    soloed: boolean;
    stereoPan: number;
    startTime: number;
    endTime?: number;
    fadeIn?: Fade;
    fadeOut?: Fade;
    cueIn?: number;
    cueOut?: number;
}
interface Fade {
    start: number;
    end: number;
    type: FadeType;
}
type FadeType = 'logarithmic' | 'linear' | 'sCurve' | 'exponential';
interface PlaylistConfig {
    samplesPerPixel?: number;
    waveHeight?: number;
    container?: HTMLElement;
    isAutomaticScroll?: boolean;
    timescale?: boolean;
    colors?: {
        waveOutlineColor?: string;
        waveFillColor?: string;
        waveProgressColor?: string;
    };
    controls?: {
        show?: boolean;
        width?: number;
    };
    zoomLevels?: number[];
}
interface PlayoutState {
    isPlaying: boolean;
    isPaused: boolean;
    cursor: number;
    duration: number;
}
interface TimeSelection {
    start: number;
    end: number;
}
declare enum InteractionState {
    Cursor = "cursor",
    Select = "select",
    Shift = "shift",
    FadeIn = "fadein",
    FadeOut = "fadeout"
}

declare function samplesToSeconds(samples: number, sampleRate: number): number;
declare function secondsToSamples(seconds: number, sampleRate: number): number;
declare function samplesToPixels(samples: number, samplesPerPixel: number): number;
declare function pixelsToSamples(pixels: number, samplesPerPixel: number): number;
declare function pixelsToSeconds(pixels: number, samplesPerPixel: number, sampleRate: number): number;
declare function secondsToPixels(seconds: number, samplesPerPixel: number, sampleRate: number): number;

export { type AudioBuffer$1 as AudioBuffer, type AudioClip, type ClipTrack, type CreateClipOptions, type CreateTrackOptions, type Fade, type FadeType, type Gap, InteractionState, type PlaylistConfig, type PlayoutState, type TimeSelection, type Timeline, type Track, type WaveformConfig, clipsOverlap, createClip, createTimeline, createTrack, findGaps, getClipsAtTime, getClipsInRange, pixelsToSamples, pixelsToSeconds, samplesToPixels, samplesToSeconds, secondsToPixels, secondsToSamples, sortClipsByTime };
