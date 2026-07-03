export { SpectrogramOrchestrator } from './SpectrogramOrchestrator';
export type {
  SpectrogramOrchestratorOptions,
  ClipRegistration,
  CanvasRegistration,
  ViewportState,
} from './SpectrogramOrchestrator';
export type { ViewportReadyDetail } from './events';
export { classifyViewport } from './viewport-classify';
export type { CanvasMeta, ViewportBounds, ClassifiedTiers } from './viewport-classify';
export { groupContiguousChunks, groupRenderableChunks } from './chunk-grouping';
export type { ChunkLike, RenderableChunkLike } from './chunk-grouping';
export { ColorLUTCache } from './color-lut-cache';
