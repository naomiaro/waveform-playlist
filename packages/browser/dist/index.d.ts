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
    constructor(config: PlaylistConfig);
    load(trackConfigs: TrackConfig[]): Promise<void>;
    private render;
    play(startTime?: number): Promise<void>;
    pause(): void;
    stop(): void;
    getEventEmitter(): any;
    destroy(): void;
}
export declare function init(config: PlaylistConfig): WaveformPlaylistClass;
declare const _default: {
    init: typeof init;
};
export default _default;
//# sourceMappingURL=index.d.ts.map