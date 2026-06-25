// Tone.js batteries-included surface for @waveform-playlist/browser.
// Import from '@waveform-playlist/browser/tone'. Everything here depends on the
// optional peers `tone` and `@waveform-playlist/playout` (#510 — keeps the core
// `@waveform-playlist/browser` entry free of any static tone/playout import).

export { useAudioTracks } from './hooks/useAudioTracks';
export type { AudioTrackConfig } from './hooks/useAudioTracks';

export { useMasterAnalyser } from './hooks/useAudioEffects';

export { useDynamicEffects } from './hooks/useDynamicEffects';
export type { UseDynamicEffectsReturn, ActiveEffect } from './hooks/useDynamicEffects';

export { useTrackDynamicEffects } from './hooks/useTrackDynamicEffects';
export type {
  UseTrackDynamicEffectsReturn,
  TrackActiveEffect,
  TrackEffectsState,
} from './hooks/useTrackDynamicEffects';

export { useExportWav } from './hooks/useExportWav';
export type { ExportOptions, ExportResult, UseExportWavReturn } from './hooks/useExportWav';

export { useDynamicTracks } from './hooks/useDynamicTracks';
export type { TrackSource, TrackLoadError, UseDynamicTracksReturn } from './hooks/useDynamicTracks';

export { useOutputMeter } from './hooks/useOutputMeter';
export type { UseOutputMeterOptions, UseOutputMeterReturn } from './hooks/useOutputMeter';

export {
  effectDefinitions,
  effectCategories,
  getEffectDefinition,
  getEffectsByCategory,
  createEffectInstance,
  createEffectChain,
} from './effects';
export type { EffectDefinition, EffectParameter, ParameterType, EffectInstance } from './effects';

export { ExportWavButton } from './components/ExportControls';
export type { ExportWavButtonProps } from './components/ExportControls';
