import { Track } from '@waveform-playlist/core';
interface PlaylistConfig {
    container: HTMLElement;
    samplesPerPixel?: number;
    waveHeight?: number;
    colors?: {
        waveOutlineColor?: string;
        waveFillColor?: string;
        waveProgressColor?: string;
        timeColor?: string;
    };
    controls?: {
        show?: boolean;
        width?: number;
    };
    zoomLevels?: number[];
    state?: string;
    timescale?: boolean;
    isAutomaticScroll?: boolean;
}
interface TrackConfig {
    src: string;
    name?: string;
    start?: number;
    fadeIn?: {
        duration: number;
        shape?: 'logarithmic' | 'linear' | 'sCurve' | 'exponential';
    };
    fadeOut?: {
        duration: number;
        shape?: 'logarithmic' | 'linear' | 'sCurve' | 'exponential';
    };
    gain?: number;
    muted?: boolean;
    soloed?: boolean;
    stereoPan?: number;
}
declare class WaveformPlaylistClass {
    private container;
    private root;
    private playout;
    private config;
    private tracks;
    private peaksData;
    private eventEmitter;
    private playbackState;
    private currentTime;
    private animationFrameId;
    private setProgressFn;
    constructor(config: PlaylistConfig);
    load(trackConfigs: TrackConfig[]): Promise<void>;
    private render;
    play(startTime?: number): Promise<void>;
    pause(): void;
    stop(): void;
    private startAnimation;
    private stopAnimation;
    setMasterGain(gain: number): void;
    setTrackGain(trackId: string, gain: number): void;
    setTrackMute(trackId: string, muted: boolean): void;
    setTrackSolo(trackId: string, soloed: boolean): void;
    setTrackPan(trackId: string, pan: number): void;
    private getDuration;
    rewind(): void;
    fastForward(): void;
    getCurrentTime(): number;
    getTracks(): Track[];
    private createEventEmitter;
    getEventEmitter(): any;
    destroy(): void;
}
declare const WaveformPlaylistAPI: {
    init: (config: PlaylistConfig) => WaveformPlaylistClass;
};
export declare const init: (config: PlaylistConfig) => WaveformPlaylistClass;
export type { PlaylistConfig, TrackConfig };
export default WaveformPlaylistAPI;
//# sourceMappingURL=index.d.ts.map