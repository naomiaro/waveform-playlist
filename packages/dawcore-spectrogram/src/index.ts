// Computation
export {
  computeSpectrogram,
  computeSpectrogramMono,
  getColorMap,
  getFrequencyScale,
  pixelColumnToFrame,
  pixelRowToBin,
  computePaddedFftRange,
} from './computation';
export type {
  FrequencyScaleName,
  PixelColumnToFrameParams,
  PixelRowToBinParams,
  PaddedFftRangeParams,
} from './computation';

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
  groupRenderableChunks,
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
  RenderableChunkLike,
} from './orchestrator';
