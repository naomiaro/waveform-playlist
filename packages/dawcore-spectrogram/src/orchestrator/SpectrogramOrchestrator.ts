import type { SpectrogramConfig } from '@waveform-playlist/core';
import { createSpectrogramWorkerPool } from '../worker';
import type { SpectrogramWorkerApi } from '../worker';
import { ColorLUTCache } from './color-lut-cache';

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

interface ClipEntry {
  trackId: string;
  channelData: Float32Array[];
  sampleRate: number;
  durationSamples: number;
  offsetSamples: number;
}

export class SpectrogramOrchestrator extends EventTarget {
  // protected (not private) so noUnusedLocals doesn't flag config/devicePixelRatio
  // before Task 8/9's render path begins reading them.
  protected pool: SpectrogramWorkerApi;
  protected config: SpectrogramConfig;
  protected devicePixelRatio: number;
  protected clips = new Map<string, ClipEntry>();
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
    this.colorLUT.clear();
    this.pool.terminate();
  }
}
