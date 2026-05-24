import type { SpectrogramConfig, ColorMapValue } from '@waveform-playlist/core';
import { SPECTROGRAM_DEFAULTS, DEFAULT_SPECTROGRAM_COLOR_MAP } from '@waveform-playlist/core';
import { createSpectrogramWorkerPool, SpectrogramAbortError } from '../worker';
import type { SpectrogramWorkerApi } from '../worker';
import { ColorLUTCache } from './color-lut-cache';
import { classifyViewport, type CanvasMeta, type ViewportBounds } from './viewport-classify';
import { groupContiguousChunks } from './chunk-grouping';

export interface SpectrogramOrchestratorOptions {
  readonly workerFactory: () => Worker;
  readonly workerPoolSize?: number;
  readonly config: SpectrogramConfig;
  readonly colorMap?: ColorMapValue;
  readonly devicePixelRatio?: number;
}

export interface ClipRegistration {
  readonly clipId: string;
  readonly trackId: string;
  readonly channelData: ReadonlyArray<Float32Array>;
  readonly sampleRate: number;
  readonly durationSamples: number;
  readonly offsetSamples: number;
}

export interface CanvasRegistration {
  readonly canvasId: string;
  readonly canvas: OffscreenCanvas;
  readonly clipId: string;
  readonly trackId: string;
  readonly channelIndex: number;
  readonly chunkIndex: number;
  readonly globalPixelOffset: number;
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface ViewportState extends ViewportBounds {
  readonly samplesPerPixel: number;
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
  // current generation. Cleared on every generation bump (setViewport with a
  // real change, setConfig, setColorMap, setDevicePixelRatio) AND in dispose().
  // Without this, every render — including those triggered by late
  // `registerCanvas` calls during track-by-track loading — would re-fire the
  // event for every track in the canvas map (N×N-ish ascending fan-in:
  // 3 tracks → 4+3+2+1 = 10 events; the dedup reduces this to 3).
  protected readyDispatched = new Set<string>();

  constructor(opts: SpectrogramOrchestratorOptions) {
    super();
    const poolSize = opts.workerPoolSize ?? 2;
    this.pool = createSpectrogramWorkerPool(opts.workerFactory, poolSize);
    this.config = opts.config;
    this.colorMap = opts.colorMap ?? DEFAULT_SPECTROGRAM_COLOR_MAP;
    this.devicePixelRatio =
      opts.devicePixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1);
  }

  registerClip(reg: ClipRegistration): void {
    if (this.disposed) return;
    // Defensive copy of the channel-array container — the typed-array buffers
    // are shared (Web Audio needs that), but the outer array is owned by us.
    const channelData: Float32Array[] = [...reg.channelData];
    this.clips.set(reg.clipId, {
      trackId: reg.trackId,
      channelData,
      sampleRate: reg.sampleRate,
      durationSamples: reg.durationSamples,
      offsetSamples: reg.offsetSamples,
    });
    this.pool.registerAudioData(reg.clipId, channelData, reg.sampleRate);

    // If any canvases for this clip were registered BEFORE the clip audio
    // arrived (race during track-by-track loading), they would have been
    // left black by renderGroup's missing-clip early-return. Trigger a
    // render now so they paint.
    if (this.viewport) {
      for (const canvas of this.canvases.values()) {
        if (canvas.clipId === reg.clipId) {
          this.scheduleRender();
          break;
        }
      }
    }
  }

  unregisterClip(clipId: string): void {
    if (this.disposed) return;
    if (!this.clips.has(clipId)) {
      console.warn('[dawcore-spectrogram] unregisterClip: unknown clip ' + clipId);
      return;
    }
    this.clips.delete(clipId);
    this.pool.unregisterAudioData(clipId);
  }

  registerCanvas(reg: CanvasRegistration): void {
    if (this.disposed) {
      console.warn(
        '[dawcore-spectrogram] registerCanvas after dispose — canvas ' +
          reg.canvasId +
          ' will not render (OffscreenCanvas is now dead)'
      );
      return;
    }
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
    if (!this.canvases.has(canvasId)) {
      console.warn('[dawcore-spectrogram] unregisterCanvas: unknown canvas ' + canvasId);
      return;
    }
    this.canvases.delete(canvasId);
    this.pool.unregisterCanvas(canvasId);
  }

  setViewport(state: ViewportState): void {
    if (this.disposed) return;
    if (
      !Number.isFinite(state.visibleStartPx) ||
      !Number.isFinite(state.visibleEndPx) ||
      !Number.isFinite(state.bufferStartPx) ||
      !Number.isFinite(state.bufferEndPx) ||
      !Number.isFinite(state.samplesPerPixel) ||
      state.samplesPerPixel <= 0 ||
      state.visibleStartPx > state.visibleEndPx ||
      state.bufferStartPx > state.bufferEndPx
    ) {
      console.warn(
        '[dawcore-spectrogram] setViewport: invalid state — ignored (' + JSON.stringify(state) + ')'
      );
      return;
    }
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
    if (this.disposed) return;
    if (!Number.isFinite(dpr) || dpr <= 0) {
      console.warn(
        '[dawcore-spectrogram] setDevicePixelRatio: invalid value ' + dpr + ' — ignored'
      );
      return;
    }
    if (this.devicePixelRatio === dpr) return;
    this.devicePixelRatio = dpr;
    const prevGeneration = this.generation;
    this.generation += 1;
    this.readyDispatched.clear();
    this.pool.abortGeneration(prevGeneration);
    this.scheduleRender();
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
      this.runRender(this.generation).catch((err) => {
        if (err instanceof SpectrogramAbortError) return;
        console.warn(
          '[dawcore-spectrogram] runRender unhandled rejection (generation ' +
            this.generation +
            '): ' +
            (err instanceof Error ? err.message : String(err))
        );
      });
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
      try {
        const tiers = classifyViewport(trackCanvases, viewport);
        // Phase 1a: viewport tier — render synchronously (priority)
        await this.renderTier(tiers.viewport, generation, viewport);
        if (this.generation !== generation || this.disposed) return;
        if (!this.readyDispatched.has(trackId)) {
          this.readyDispatched.add(trackId);
          this.dispatchEvent(
            new CustomEvent('viewport-ready', { detail: { trackId, generation } })
          );
        }
        // Phase 1b: buffer tier
        await this.renderTier(tiers.buffer, generation, viewport);
        if (this.generation !== generation || this.disposed) return;
        // Phase 2: remaining — yield via requestIdleCallback
        await this.renderRemainingViaIdle(tiers.remaining, generation, viewport);
      } catch (err) {
        if (this.generation !== generation || this.disposed) return;
        if (err instanceof SpectrogramAbortError) {
          // Normal abort — generation bumped mid-render. Not an error.
          return;
        }
        const error = err instanceof Error ? err : new Error(String(err));
        console.warn(
          '[dawcore-spectrogram] render failed for track ' +
            trackId +
            ' (generation ' +
            generation +
            '): ' +
            error.message
        );
        this.dispatchEvent(
          new CustomEvent('viewport-error', {
            detail: { trackId, generation, error },
          })
        );
        // Continue to next track — one failure doesn't break siblings.
      }
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
    if (!clip) {
      console.warn(
        '[dawcore-spectrogram] renderGroup: no clip audio for ' +
          first.clipId +
          ' (canvas ' +
          first.canvasId +
          ') — canvas will stay black until registerClip is called'
      );
      return;
    }

    const fftSize = this.config.fftSize ?? SPECTROGRAM_DEFAULTS.fftSize;
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
        frequencyScale: String(this.config.frequencyScale ?? SPECTROGRAM_DEFAULTS.frequencyScale),
        minFrequency: this.config.minFrequency ?? SPECTROGRAM_DEFAULTS.minFrequency,
        maxFrequency: this.config.maxFrequency ?? clip.sampleRate / 2,
        gainDb: this.config.gainDb ?? SPECTROGRAM_DEFAULTS.gainDb,
        rangeDb: this.config.rangeDb ?? SPECTROGRAM_DEFAULTS.rangeDb,
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
      try {
        await this.renderGroup(group, generation, viewport);
      } catch (err) {
        if (this.generation !== generation || this.disposed) return;
        if (err instanceof SpectrogramAbortError) return;
        const error = err instanceof Error ? err : new Error(String(err));
        console.warn(
          '[dawcore-spectrogram] remaining-tier render failed for canvas group: ' + error.message
        );
        // Continue to next group
      }
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

// Compile-time guard: any future field added to ViewportState must be added
// to viewportsEqual or this `satisfies` check will fail.
const _VIEWPORT_STATE_FIELDS_COVERED_BY_EQUAL = {
  visibleStartPx: true,
  visibleEndPx: true,
  bufferStartPx: true,
  bufferEndPx: true,
  samplesPerPixel: true,
} satisfies Record<keyof ViewportState, true>;
// Mark as used so noUnusedLocals doesn't complain
void _VIEWPORT_STATE_FIELDS_COVERED_BY_EQUAL;
