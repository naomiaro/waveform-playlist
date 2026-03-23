/**
 * Peak generation pipeline: AudioBuffer → web worker → WaveformData → PeakData.
 *
 * Manages worker lifecycle, WaveformData caching per AudioBuffer (WeakMap),
 * inflight dedup, and peak extraction via resample() for any zoom level
 * coarser than the base scale.
 *
 * The base scale determines the finest zoom level that can be rendered without
 * regenerating. Resampling only works to coarser (larger) scales. Set baseScale
 * to the finest zoom level the user might need.
 */

import type WaveformData from 'waveform-data';
import type { PeakData } from '@waveform-playlist/core';
import { createPeaksWorker, type PeaksWorkerApi } from './peaksWorker';
import { extractPeaks } from './waveformDataUtils';

export class PeakPipeline {
  private _worker: PeaksWorkerApi | null = null;
  private _cache = new WeakMap<AudioBuffer, WaveformData>();
  private _inflight = new WeakMap<AudioBuffer, Promise<WaveformData>>();
  private _baseScale: number;
  private _bits: 8 | 16;

  constructor(baseScale = 128, bits: 8 | 16 = 16) {
    this._baseScale = baseScale;
    this._bits = bits;
  }

  /**
   * Inject externally-loaded WaveformData (e.g., from a .dat file) into the cache.
   * Prevents worker generation for this AudioBuffer on all subsequent calls.
   */
  cacheWaveformData(audioBuffer: AudioBuffer, waveformData: WaveformData): void {
    this._cache.set(audioBuffer, waveformData);
  }

  /**
   * Generate PeakData for a clip from its AudioBuffer.
   * Uses cached WaveformData when available; otherwise generates via worker.
   * Worker generates at baseScale (default 128); extractPeaks resamples to the requested zoom.
   */
  async generatePeaks(
    audioBuffer: AudioBuffer,
    samplesPerPixel: number,
    isMono: boolean,
    offsetSamples?: number,
    durationSamples?: number
  ): Promise<PeakData> {
    const waveformData = await this._getWaveformData(audioBuffer);
    const effectiveScale = this._clampScale(waveformData, samplesPerPixel);
    try {
      return extractPeaks(waveformData, effectiveScale, isMono, offsetSamples, durationSamples);
    } catch (err) {
      console.warn('[dawcore] extractPeaks failed: ' + String(err));
      throw err;
    }
  }

  /**
   * Re-extract peaks for all clips at a new zoom level using cached WaveformData.
   * Returns a new Map of clipId → PeakData. Clips without cached data are skipped.
   * When the requested scale is finer than cached data, peaks are clamped to the
   * cached scale and a single summary warning is logged.
   */
  reextractPeaks(
    clipBuffers: ReadonlyMap<string, AudioBuffer>,
    samplesPerPixel: number,
    isMono: boolean,
    clipOffsets?: ReadonlyMap<string, { offsetSamples: number; durationSamples: number }>
  ): Map<string, PeakData> {
    const result = new Map<string, PeakData>();
    let clampedCount = 0;
    let clampedScale = 0;
    for (const [clipId, audioBuffer] of clipBuffers) {
      const cached = this._cache.get(audioBuffer);
      if (cached) {
        const effectiveScale = this._clampScale(cached, samplesPerPixel, false);
        if (effectiveScale !== samplesPerPixel) {
          clampedCount++;
          clampedScale = effectiveScale;
        }
        try {
          const offsets = clipOffsets?.get(clipId);
          result.set(
            clipId,
            extractPeaks(
              cached,
              effectiveScale,
              isMono,
              offsets?.offsetSamples,
              offsets?.durationSamples
            )
          );
        } catch (err) {
          console.warn('[dawcore] reextractPeaks failed for clip ' + clipId + ': ' + String(err));
        }
      }
    }
    if (clampedCount > 0) {
      console.warn(
        '[dawcore] Requested zoom ' +
          samplesPerPixel +
          ' spp is finer than pre-computed peaks (' +
          clampedScale +
          ' spp) — ' +
          clampedCount +
          ' clip(s) using available resolution'
      );
    }
    return result;
  }

  /**
   * Clamp requested scale to cached WaveformData scale.
   * WaveformData.resample() can only go coarser — if the requested zoom is
   * finer than the cached data, use the cached scale. Set warn=true to log
   * (default); reextractPeaks passes false and logs a single summary instead.
   */
  private _clampScale(
    waveformData: WaveformData,
    requestedScale: number,
    warn = true
  ): number {
    if (requestedScale < waveformData.scale) {
      if (warn) {
        console.warn(
          '[dawcore] Requested zoom ' +
            requestedScale +
            ' spp is finer than pre-computed peaks (' +
            waveformData.scale +
            ' spp) — using available resolution'
        );
      }
      return waveformData.scale;
    }
    return requestedScale;
  }

  /**
   * Return the coarsest (largest) scale among cached WaveformData entries
   * that correspond to the given clip buffers. Returns 0 if none are cached.
   */
  getMaxCachedScale(clipBuffers: ReadonlyMap<string, AudioBuffer>): number {
    let max = 0;
    for (const audioBuffer of clipBuffers.values()) {
      const cached = this._cache.get(audioBuffer);
      if (cached && cached.scale > max) max = cached.scale;
    }
    return max;
  }

  terminate() {
    this._worker?.terminate();
    this._worker = null;
  }

  private async _getWaveformData(audioBuffer: AudioBuffer): Promise<WaveformData> {
    const cached = this._cache.get(audioBuffer);
    if (cached) return cached;

    const inflight = this._inflight.get(audioBuffer);
    if (inflight) return inflight;

    if (!this._worker) {
      this._worker = createPeaksWorker();
    }

    // Generate at baseScale — the finest zoom we can resample from
    // .slice() channel buffers to avoid detaching the original AudioBuffer views
    const channels: ArrayBuffer[] = [];
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      channels.push(audioBuffer.getChannelData(c).slice().buffer as ArrayBuffer);
    }

    const promise = this._worker
      .generate({
        channels,
        length: audioBuffer.length,
        sampleRate: audioBuffer.sampleRate,
        scale: this._baseScale,
        bits: this._bits,
        splitChannels: true,
      })
      .then((waveformData) => {
        this._cache.set(audioBuffer, waveformData);
        this._inflight.delete(audioBuffer);
        return waveformData;
      })
      .catch((err) => {
        this._inflight.delete(audioBuffer);
        console.warn('[dawcore] Peak generation via worker failed: ' + String(err));
        throw err;
      });

    this._inflight.set(audioBuffer, promise);
    return promise;
  }
}
