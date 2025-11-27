export { TonePlayout } from './TonePlayout';
export { ToneTrack } from './ToneTrack';
export type { TonePlayoutOptions, EffectsFunction } from './TonePlayout';
export type { ToneTrackOptions, TrackEffectsFunction } from './ToneTrack';

// Export global AudioContext manager
export {
  getGlobalContext,
  getGlobalAudioContext,
  getGlobalToneContext,
  resumeGlobalAudioContext,
  getGlobalAudioContextState,
  closeGlobalAudioContext,
} from './audioContext';

// Export MediaStreamSource manager
export {
  getMediaStreamSource,
  releaseMediaStreamSource,
  hasMediaStreamSource,
} from './mediaStreamSourceManager';

// Export fade utilities
export {
  applyFadeIn,
  applyFadeOut,
  type FadeConfig,
  type FadeType,
} from './fades';
