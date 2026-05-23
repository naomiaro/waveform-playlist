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

// Orchestrator
export {
  SpectrogramOrchestrator,
  ColorLUTCache,
  classifyViewport,
  groupContiguousChunks,
} from './orchestrator';
export type {
  SpectrogramOrchestratorOptions,
  ClipRegistration,
  CanvasRegistration,
  ViewportState,
  ViewportReadyDetail,
  CanvasMeta,
  ViewportBounds,
  ClassifiedTiers,
  ChunkLike,
} from './orchestrator';
