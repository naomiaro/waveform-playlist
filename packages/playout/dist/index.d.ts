import * as Tone from 'tone';
import { Track, FadeType } from '@waveform-playlist/core';

interface ToneTrackOptions {
    buffer: AudioBuffer;
    track: Track;
}
declare class ToneTrack {
    private player;
    private volumeNode;
    private panNode;
    private fadeGain;
    private muteGain;
    private track;
    private audioBuffer;
    private pausedPosition;
    private playStartTime;
    constructor(options: ToneTrackOptions);
    private gainToDb;
    applyFadeIn(start: number, duration: number, shape?: FadeType): void;
    applyFadeOut(start: number, duration: number, shape?: FadeType): void;
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
}

interface TonePlayoutOptions {
    tracks?: ToneTrack[];
    masterGain?: number;
}
declare class TonePlayout {
    private tracks;
    private masterVolume;
    private isInitialized;
    private soloedTracks;
    constructor(options?: TonePlayoutOptions);
    private gainToDb;
    init(): Promise<void>;
    addTrack(trackOptions: ToneTrackOptions): ToneTrack;
    removeTrack(trackId: string): void;
    getTrack(trackId: string): ToneTrack | undefined;
    play(when?: number, offset?: number): void;
    pause(): void;
    stop(): void;
    setMasterGain(gain: number): void;
    setSolo(trackId: string, soloed: boolean): void;
    setMute(trackId: string, muted: boolean): void;
    getCurrentTime(): number;
    seekTo(time: number): void;
    dispose(): void;
    get context(): Tone.BaseContext;
    get sampleRate(): number;
}

export { TonePlayout, type TonePlayoutOptions, ToneTrack, type ToneTrackOptions };
