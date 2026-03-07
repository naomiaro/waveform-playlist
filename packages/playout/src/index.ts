export { TonePlayout } from './TonePlayout';
export { ToneTrack } from './ToneTrack';
export { MidiToneTrack } from './MidiToneTrack';
export type { PlayableTrack, MidiClipInfo, MidiToneTrackOptions } from './MidiToneTrack';
export { SoundFontToneTrack } from './SoundFontToneTrack';
export type { SoundFontToneTrackOptions } from './SoundFontToneTrack';
export {
  SoundFontCache,
  timecentsToSeconds,
  getGeneratorValue,
  int16ToFloat32,
  calculatePlaybackRate,
  extractLoopAndEnvelope,
} from './SoundFontCache';
export type { SoundFontSample, PlaybackRateParams, LoopAndEnvelopeParams } from './SoundFontCache';
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
  getUnderlyingAudioParam,
  type FadeConfig,
  type FadeType,
} from './fades';

// Export Tone.js adapter for engine integration
export { createToneAdapter } from './TonePlayoutAdapter';
export type { ToneAdapterOptions } from './TonePlayoutAdapter';
