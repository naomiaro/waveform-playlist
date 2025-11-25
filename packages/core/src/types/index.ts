export interface WaveformConfig {
  sampleRate: number;
  samplesPerPixel: number;
  waveHeight?: number;
  waveOutlineColor?: string;
  waveFillColor?: string;
  waveProgressColor?: string;
}

export interface AudioBuffer {
  length: number;
  duration: number;
  numberOfChannels: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

export interface Track {
  id: string;
  name: string;
  src?: string | AudioBuffer; // Support both URL strings and AudioBuffer objects
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

/**
 * Simple fade configuration
 */
export interface Fade {
  /** Duration of the fade in seconds */
  duration: number;
  /** Type of fade curve (default: 'linear') */
  type?: FadeType;
}

export type FadeType = 'logarithmic' | 'linear' | 'sCurve' | 'exponential';

export interface PlaylistConfig {
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

export interface PlayoutState {
  isPlaying: boolean;
  isPaused: boolean;
  cursor: number;
  duration: number;
}

export interface TimeSelection {
  start: number;
  end: number;
}

export enum InteractionState {
  Cursor = 'cursor',
  Select = 'select',
  Shift = 'shift',
  FadeIn = 'fadein',
  FadeOut = 'fadeout',
}

// Export clip-based model types
export * from './clip';
