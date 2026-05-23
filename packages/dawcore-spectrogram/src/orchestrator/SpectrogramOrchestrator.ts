import type { SpectrogramConfig } from '@waveform-playlist/core';
import { createSpectrogramWorkerPool } from '../worker';
import type { SpectrogramWorkerApi } from '../worker';
import { ColorLUTCache } from './color-lut-cache';
import type { CanvasMeta, ViewportBounds } from './viewport-classify';

export interface SpectrogramOrchestratorOptions {
  workerFactory: () => Worker;
  workerPoolSize?: number;
  config: SpectrogramConfig;
  devicePixelRatio?: number;
}

export interface ClipRegistration {
  clipId: string;
  trackId: string;
  channelData: Float32Array[];
  sampleRate: number;
  durationSamples: number;
  offsetSamples: number;
}

export interface CanvasRegistration {
  canvasId: string;
  canvas: OffscreenCanvas;
  clipId: string;
  trackId: string;
  channelIndex: number;
  chunkIndex: number;
  globalPixelOffset: number;
  widthPx: number;
  heightPx: number;
}

export interface ViewportState extends ViewportBounds {
  samplesPerPixel: number;
}

interface ClipEntry {
  trackId: string;
  channelData: Float32Array[];
  sampleRate: number;
  durationSamples: number;
  offsetSamples: number;
}

interface CanvasEntry extends CanvasMeta {
  clipId: string;
  trackId: string;
  channelIndex: number;
  chunkIndex: number;
  heightPx: number;
}

export class SpectrogramOrchestrator extends EventTarget {
  // protected (not private) so noUnusedLocals doesn't flag config/devicePixelRatio
  // before Task 9's render path begins reading them.
  protected pool: SpectrogramWorkerApi;
  protected config: SpectrogramConfig;
  protected devicePixelRatio: number;
  protected clips = new Map<string, ClipEntry>();
  protected canvases = new Map<string, CanvasEntry>();
  protected viewport: ViewportState | null = null;
  protected generation = 0;
  protected colorLUT = new ColorLUTCache();
  protected disposed = false;

  constructor(opts: SpectrogramOrchestratorOptions) {
    super();
    const poolSize = opts.workerPoolSize ?? 2;
    this.pool = createSpectrogramWorkerPool(opts.workerFactory, poolSize);
    this.config = opts.config;
    this.devicePixelRatio =
      opts.devicePixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1);
  }

  registerClip(reg: ClipRegistration): void {
    if (this.disposed) return;
    this.clips.set(reg.clipId, {
      trackId: reg.trackId,
      channelData: reg.channelData,
      sampleRate: reg.sampleRate,
      durationSamples: reg.durationSamples,
      offsetSamples: reg.offsetSamples,
    });
    this.pool.registerAudioData(reg.clipId, reg.channelData, reg.sampleRate);
  }

  unregisterClip(clipId: string): void {
    if (this.disposed) return;
    if (!this.clips.has(clipId)) return;
    this.clips.delete(clipId);
    this.pool.unregisterAudioData(clipId);
  }

  registerCanvas(reg: CanvasRegistration): void {
    if (this.disposed) return;
    this.canvases.set(reg.canvasId, {
      canvasId: reg.canvasId,
      globalPixelOffset: reg.globalPixelOffset,
      widthPx: reg.widthPx,
      heightPx: reg.heightPx,
      clipId: reg.clipId,
      trackId: reg.trackId,
      channelIndex: reg.channelIndex,
      chunkIndex: reg.chunkIndex,
    });
    this.pool.registerCanvas(reg.canvasId, reg.canvas);
    if (this.viewport) this.scheduleRender();
  }

  unregisterCanvas(canvasId: string): void {
    if (this.disposed) return;
    if (!this.canvases.has(canvasId)) return;
    this.canvases.delete(canvasId);
    this.pool.unregisterCanvas(canvasId);
  }

  setViewport(state: ViewportState): void {
    if (this.disposed) return;
    const prevGeneration = this.generation;
    this.generation += 1;
    this.pool.abortGeneration(prevGeneration);
    this.viewport = state;
    this.scheduleRender();
  }

  setConfig(config: SpectrogramConfig): void {
    if (this.disposed) return;
    this.config = config;
  }

  setDevicePixelRatio(dpr: number): void {
    this.devicePixelRatio = dpr;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clips.clear();
    this.canvases.clear();
    this.viewport = null;
    this.colorLUT.clear();
    this.pool.terminate();
  }

  // Stub — real 3-tier dispatch lands in Task 9.
  protected scheduleRender(): void {
    // no-op until Task 9
  }
}
