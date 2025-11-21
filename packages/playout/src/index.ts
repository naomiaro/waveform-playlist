import * as Tone from 'tone';
import { getGlobalAudioContext } from './audioContext';

// Initialize Tone.js to use our global AudioContext
Tone.setContext(getGlobalAudioContext());

export { TonePlayout } from './TonePlayout';
export { ToneTrack } from './ToneTrack';
export type { TonePlayoutOptions } from './TonePlayout';
export type { ToneTrackOptions } from './ToneTrack';

// Export global AudioContext manager
export {
  getGlobalAudioContext,
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
