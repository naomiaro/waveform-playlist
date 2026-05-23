import type { SpectrogramConfig, ColorMapValue } from '@waveform-playlist/core';
import { createSpectrogramWorkerPool } from '../worker';
import type { SpectrogramWorkerApi } from '../worker';
import { ColorLUTCache } from './color-lut-cache';
import { classifyViewport, type CanvasMeta, type ViewportBounds } from './viewport-classify';
import { groupContiguousChunks } from './chunk-grouping';

export interface SpectrogramOrchestratorOptions {
  workerFactory: () => Worker;
  workerPoolSize?: number;
  config: SpectrogramConfig;
  colorMap?: ColorMapValue;
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
  protected pool: SpectrogramWorkerApi;
  protected config: SpectrogramConfig;
  protected colorMap: ColorMapValue;
  protected devicePixelRatio: number;
  protected clips = new Map<string, ClipEntry>();
  protected canvases = new Map<string, CanvasEntry>();
  protected viewport: ViewportState | null = null;
  protected generation = 0;
  protected colorLUT = new ColorLUTCache();
  protected disposed = false;
  protected renderInFlight = false;
  // Tracks which trackIds have already emitted `viewport-ready` for the
  // current generation. Cleared on every generation bump (setViewport /
  // setConfig / setColorMap). Without this, every render — including
  // those triggered by late `registerCanvas` calls during track-by-track
  // loading — would re-fire the event for every track in the canvas map.
  protected readyDispatched = new Set<string>();

  constructor(opts: SpectrogramOrchestratorOptions) {
    super();
    const poolSize = opts.workerPoolSize ?? 2;
    this.pool = createSpectrogramWorkerPool(opts.workerFactory, poolSize);
    this.config = opts.config;
    this.colorMap = opts.colorMap ?? 'viridis';
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
    if (this.viewport && viewportsEqual(this.viewport, state)) return;
    const prevGeneration = this.generation;
    this.generation += 1;
    this.readyDispatched.clear();
    this.pool.abortGeneration(prevGeneration);
    this.viewport = state;
    this.scheduleRender();
  }

  setConfig(config: SpectrogramConfig): void {
    if (this.disposed) return;
    this.config = config;
    const prevGeneration = this.generation;
    this.generation += 1;
    this.readyDispatched.clear();
    this.pool.abortGeneration(prevGeneration);
    this.colorLUT.clear();
    this.scheduleRender();
  }

  setColorMap(colorMap: ColorMapValue): void {
    if (this.disposed) return;
    this.colorMap = colorMap;
    const prevGeneration = this.generation;
    this.generation += 1;
    this.readyDispatched.clear();
    this.pool.abortGeneration(prevGeneration);
    this.scheduleRender();
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
    this.readyDispatched.clear();
    this.pool.terminate();
  }

  protected scheduleRender(): void {
    if (this.renderInFlight) return;
    if (!this.viewport) return;
    this.renderInFlight = true;
    queueMicrotask(() => {
      this.renderInFlight = false;
      void this.runRender(this.generation);
    });
  }

  protected async runRender(generation: number): Promise<void> {
    if (this.disposed) return;
    const viewport = this.viewport;
    if (!viewport) return;

    const canvasesByTrack = new Map<string, CanvasEntry[]>();
    for (const c of this.canvases.values()) {
      const list = canvasesByTrack.get(c.trackId) ?? [];
      list.push(c);
      canvasesByTrack.set(c.trackId, list);
    }

    for (const [trackId, trackCanvases] of canvasesByTrack) {
      const tiers = classifyViewport(trackCanvases, viewport);
      // Phase 1a: viewport tier — render synchronously (priority)
      await this.renderTier(tiers.viewport, generation, viewport);
      if (this.generation !== generation || this.disposed) return;
      if (!this.readyDispatched.has(trackId)) {
        this.readyDispatched.add(trackId);
        this.dispatchEvent(new CustomEvent('viewport-ready', { detail: { trackId } }));
      }
      // Phase 1b: buffer tier
      await this.renderTier(tiers.buffer, generation, viewport);
      if (this.generation !== generation || this.disposed) return;
      // Phase 2: remaining — yield via requestIdleCallback
      await this.renderRemainingViaIdle(tiers.remaining, generation, viewport);
    }
  }

  protected async renderTier(
    canvases: CanvasEntry[],
    generation: number,
    viewport: ViewportState
  ): Promise<void> {
    if (canvases.length === 0) return;
    const groups = groupContiguousChunks(canvases);
    for (const group of groups) {
      if (this.generation !== generation || this.disposed) return;
      await this.renderGroup(group, generation, viewport);
    }
  }

  protected async renderGroup(
    group: CanvasEntry[],
    generation: number,
    viewport: ViewportState
  ): Promise<void> {
    if (group.length === 0) return;
    const first = group[0];
    const clip = this.clips.get(first.clipId);
    if (!clip) return;

    const fftSize = this.config.fftSize ?? 2048;
    const startPx = Math.min(...group.map((c) => c.globalPixelOffset));
    const endPx = Math.max(...group.map((c) => c.globalPixelOffset + c.widthPx));
    const startSample = clip.offsetSamples + Math.floor(startPx * viewport.samplesPerPixel);
    const endSample = Math.min(
      clip.offsetSamples + clip.durationSamples,
      clip.offsetSamples + Math.ceil(endPx * viewport.samplesPerPixel)
    );
    const paddedStart = Math.max(clip.offsetSamples, startSample - fftSize);
    const paddedEnd = Math.min(clip.offsetSamples + clip.durationSamples, endSample + fftSize);

    const { cacheKey } = await this.pool.computeFFT(
      {
        clipId: first.clipId,
        channelDataArrays: clip.channelData,
        config: this.config,
        sampleRate: clip.sampleRate,
        offsetSamples: clip.offsetSamples,
        durationSamples: clip.durationSamples,
        mono: false,
        sampleRange: { start: paddedStart, end: paddedEnd },
      },
      generation
    );
    if (this.generation !== generation || this.disposed) return;

    const colorLUT = this.colorLUT.get(this.colorMap);
    await this.pool.renderChunks(
      {
        cacheKey,
        canvasIds: group.map((c) => c.canvasId),
        canvasWidths: group.map((c) => c.widthPx),
        globalPixelOffsets: group.map((c) => c.globalPixelOffset),
        canvasHeight: first.heightPx,
        devicePixelRatio: this.devicePixelRatio,
        samplesPerPixel: viewport.samplesPerPixel,
        colorLUT,
        frequencyScale: String(this.config.frequencyScale ?? 'mel'),
        minFrequency: this.config.minFrequency ?? 0,
        maxFrequency: this.config.maxFrequency ?? clip.sampleRate / 2,
        gainDb: this.config.gainDb ?? 20,
        rangeDb: this.config.rangeDb ?? 80,
        channelIndex: first.channelIndex,
      },
      generation
    );
  }

  protected async renderRemainingViaIdle(
    canvases: CanvasEntry[],
    generation: number,
    viewport: ViewportState
  ): Promise<void> {
    if (canvases.length === 0) return;
    const groups = groupContiguousChunks(canvases);
    for (const group of groups) {
      if (this.generation !== generation || this.disposed) return;
      await this.yieldUntilIdle();
      if (this.generation !== generation || this.disposed) return;
      await this.renderGroup(group, generation, viewport);
    }
  }

  protected yieldUntilIdle(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => resolve());
      } else {
        setTimeout(resolve, 0);
      }
    });
  }
}

function viewportsEqual(a: ViewportState, b: ViewportState): boolean {
  return (
    a.visibleStartPx === b.visibleStartPx &&
    a.visibleEndPx === b.visibleEndPx &&
    a.bufferStartPx === b.bufferStartPx &&
    a.bufferEndPx === b.bufferEndPx &&
    a.samplesPerPixel === b.samplesPerPixel
  );
}
