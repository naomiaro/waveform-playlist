import type { FadeType } from '@waveform-playlist/core';

export interface TrackDescriptor {
  name: string;
  src: string;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  clips: ClipDescriptor[];
}

export interface ClipDescriptor {
  /**
   * Optional id from the source `<daw-clip>` element. When present, the engine
   * clip's `id` is set to this value so DOM and engine refer to the same clip.
   */
  clipId?: string;
  src: string;
  peaksSrc: string;
  start: number;
  duration: number;
  offset: number;
  gain: number;
  name: string;
  fadeIn: number;
  fadeOut: number;
  fadeType: FadeType;
}

/**
 * Public input shape for `editor.addTrack(config)`. All fields optional —
 * defaults match the declarative `<daw-track>` defaults.
 */
export interface TrackConfig {
  name?: string;
  volume?: number;
  pan?: number;
  muted?: boolean;
  soloed?: boolean;
  clips?: ClipConfig[];
}

/**
 * Public input shape for clips passed via `TrackConfig.clips` or
 * `editor.addClip(trackId, config)`. `src` is required — every clip needs
 * an audio source to load. Other fields default to the matching
 * `<daw-clip>` attribute defaults.
 */
export interface ClipConfig {
  src: string;
  peaksSrc?: string;
  start?: number;
  duration?: number;
  offset?: number;
  gain?: number;
  name?: string;
  fadeIn?: number;
  fadeOut?: number;
  fadeType?: FadeType;
}
