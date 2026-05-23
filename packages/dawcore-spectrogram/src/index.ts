// Computation
export {
  computeSpectrogram,
  computeSpectrogramMono,
  getColorMap,
  getFrequencyScale,
} from './computation';
export type { FrequencyScaleName } from './computation';

// Worker
export { createSpectrogramWorker, SpectrogramAbortError } from './worker';
export { createSpectrogramWorkerPool } from './worker';
export type {
  SpectrogramWorkerApi,
  SpectrogramWorkerFFTParams,
  SpectrogramWorkerRenderChunksParams,
} from './worker';
