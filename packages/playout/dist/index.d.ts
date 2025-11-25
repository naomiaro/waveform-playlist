import { Gain, ToneAudioNode, Volume, BaseContext } from 'tone';
import { FadeType, Track } from '@waveform-playlist/core';

type TrackEffectsFunction = (graphEnd: Gain, masterGainNode: ToneAudioNode, isOffline: boolean) => void | (() => void);
interface ClipInfo {
    buffer: AudioBuffer;
    startTime: number;
    duration: number;
    offset: number;
    fadeIn?: {
        start: number;
        end: number;
        type: FadeType;
    };
    fadeOut?: {
        start: number;
        end: number;
        type: FadeType;
    };
    gain: number;
}
interface ToneTrackOptions {
    buffer?: AudioBuffer;
    clips?: ClipInfo[];
    track: Track;
    effects?: TrackEffectsFunction;
    destination?: ToneAudioNode;
}
declare class ToneTrack {
    private clips;
    private volumeNode;
    private panNode;
    private muteGain;
    private track;
    private effectsCleanup?;
    private onStopCallback?;
    private activePlayers;
    constructor(options: ToneTrackOptions);
    private gainToDb;
    setVolume(gain: number): void;
    setPan(pan: number): void;
    setMute(muted: boolean): void;
    setSolo(soloed: boolean): void;
    play(when?: number, offset?: number, duration?: number): void;
    pause(): void;
    stop(when?: number): void;
    dispose(): void;
    get id(): string;
    get duration(): number;
    get buffer(): AudioBuffer;
    get isPlaying(): boolean;
    get muted(): boolean;
    get startTime(): number;
    setOnStopCallback(callback: () => void): void;
}

type EffectsFunction = (masterGainNode: Volume, destination: ToneAudioNode, isOffline: boolean) => void | (() => void);
interface TonePlayoutOptions {
    tracks?: ToneTrack[];
    masterGain?: number;
    effects?: EffectsFunction;
}
declare class TonePlayout {
    private tracks;
    private masterVolume;
    private isInitialized;
    private soloedTracks;
    private manualMuteState;
    private effectsCleanup?;
    private onPlaybackCompleteCallback?;
    private activeTracks;
    private playbackSessionId;
    constructor(options?: TonePlayoutOptions);
    private gainToDb;
    init(): Promise<void>;
    addTrack(trackOptions: ToneTrackOptions): ToneTrack;
    removeTrack(trackId: string): void;
    getTrack(trackId: string): ToneTrack | undefined;
    play(when?: number, offset?: number, duration?: number): void;
    pause(): void;
    stop(): void;
    setMasterGain(gain: number): void;
    setSolo(trackId: string, soloed: boolean): void;
    private updateSoloMuting;
    setMute(trackId: string, muted: boolean): void;
    getCurrentTime(): number;
    seekTo(time: number): void;
    dispose(): void;
    get context(): BaseContext;
    get sampleRate(): number;
    setOnPlaybackComplete(callback: () => void): void;
}

/**
 * Global AudioContext Manager
 *
 * Provides a single AudioContext shared across the entire application.
 * This context is used by Tone.js for playback and by all recording/monitoring hooks.
 */
/**
 * Get or create the global AudioContext
 * @returns The global AudioContext instance
 */
declare function getGlobalAudioContext(): AudioContext;
/**
 * Resume the global AudioContext if it's suspended
 * Should be called in response to a user gesture (e.g., button click)
 * @returns Promise that resolves when context is running
 */
declare function resumeGlobalAudioContext(): Promise<void>;
/**
 * Get the current state of the global AudioContext
 * @returns The AudioContext state ('suspended', 'running', or 'closed')
 */
declare function getGlobalAudioContextState(): AudioContextState;
/**
 * Close the global AudioContext
 * Should only be called when the application is shutting down
 */
declare function closeGlobalAudioContext(): Promise<void>;

/**
 * MediaStreamSource Manager
 *
 * Manages MediaStreamAudioSourceNode instances to ensure only one source
 * is created per MediaStream per AudioContext.
 *
 * Web Audio API constraint: You can only create one MediaStreamAudioSourceNode
 * per MediaStream per AudioContext. Multiple attempts will fail or disconnect
 * previous sources.
 *
 * This manager ensures a single source is shared across multiple consumers
 * (e.g., AnalyserNode for VU meter, AudioWorkletNode for recording).
 */
/**
 * Get or create a MediaStreamAudioSourceNode for the given stream
 *
 * @param stream - The MediaStream to create a source for
 * @returns MediaStreamAudioSourceNode that can be connected to multiple nodes
 *
 * @example
 * ```typescript
 * const source = getMediaStreamSource(stream);
 *
 * // Multiple consumers can connect to the same source
 * source.connect(analyserNode);  // For VU meter
 * source.connect(workletNode);   // For recording
 * ```
 */
declare function getMediaStreamSource(stream: MediaStream): MediaStreamAudioSourceNode;
/**
 * Manually release a MediaStreamSource
 *
 * Normally you don't need to call this - cleanup happens automatically
 * when the stream ends. Only call this if you need to force cleanup.
 *
 * @param stream - The MediaStream to release the source for
 */
declare function releaseMediaStreamSource(stream: MediaStream): void;
/**
 * Check if a MediaStreamSource exists for the given stream
 *
 * @param stream - The MediaStream to check
 * @returns true if a source exists for this stream
 */
declare function hasMediaStreamSource(stream: MediaStream): boolean;

export { type EffectsFunction, TonePlayout, type TonePlayoutOptions, ToneTrack, type ToneTrackOptions, type TrackEffectsFunction, closeGlobalAudioContext, getGlobalAudioContext, getGlobalAudioContextState, getMediaStreamSource, hasMediaStreamSource, releaseMediaStreamSource, resumeGlobalAudioContext };
