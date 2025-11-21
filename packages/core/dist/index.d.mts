interface WaveformConfig {
    sampleRate: number;
    samplesPerPixel: number;
    waveHeight?: number;
    waveOutlineColor?: string;
    waveFillColor?: string;
    waveProgressColor?: string;
}
interface AudioBuffer {
    length: number;
    duration: number;
    numberOfChannels: number;
    sampleRate: number;
    getChannelData(channel: number): Float32Array;
}
interface Track {
    id: string;
    name: string;
    src?: string | AudioBuffer;
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

export { type AudioBuffer, type Fade, type FadeType, InteractionState, type PlaylistConfig, type PlayoutState, type TimeSelection, type Track, type WaveformConfig, pixelsToSamples, pixelsToSeconds, samplesToPixels, samplesToSeconds, secondsToPixels, secondsToSamples };
