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

  /**
   * Generate PeakData for a clip from its AudioBuffer.
   * Uses cached WaveformData when available; otherwise generates via worker.
   * The worker generates at `scale` (= samplesPerPixel) for exact rendering.
   */
  async generatePeaks(
    audioBuffer: AudioBuffer,
    samplesPerPixel: number,
    isMono: boolean
  ): Promise<PeakData> {
    const waveformData = await this._getWaveformData(audioBuffer, samplesPerPixel);
    try {
      return extractPeaks(waveformData, samplesPerPixel, isMono);
    } catch (err) {
      console.warn('[dawcore] extractPeaks failed: ' + String(err));
      throw err;
    }
  }

  /**
   * Re-extract peaks for all clips at a new zoom level using cached WaveformData.
   * Only works for zoom levels coarser than (or equal to) the cached base scale.
   * Returns a new Map of clipId → PeakData. Clips without cached data or where
   * the target scale is finer than the cached base are skipped.
   */
  reextractPeaks(
    clipBuffers: ReadonlyMap<string, AudioBuffer>,
    samplesPerPixel: number,
    isMono: boolean
  ): Map<string, PeakData> {
    const result = new Map<string, PeakData>();
    for (const [clipId, audioBuffer] of clipBuffers) {
      const cached = this._cache.get(audioBuffer);
      if (cached) {
        // Skip if target scale is finer than cached — resample can't downsample
        if (samplesPerPixel < cached.scale) continue;
        try {
          result.set(clipId, extractPeaks(cached, samplesPerPixel, isMono));
        } catch (err) {
          console.warn('[dawcore] reextractPeaks failed for clip ' + clipId + ': ' + String(err));
        }
      }
    }
    return result;
  }

  terminate() {
    this._worker?.terminate();
    this._worker = null;
  }

  private async _getWaveformData(
    audioBuffer: AudioBuffer,
    samplesPerPixel: number
  ): Promise<WaveformData> {
    const cached = this._cache.get(audioBuffer);
    // Use cache if it's at a scale fine enough for the requested zoom
    if (cached && cached.scale <= samplesPerPixel) return cached;

    const inflight = this._inflight.get(audioBuffer);
    if (inflight) return inflight;

    if (!this._worker) {
      this._worker = createPeaksWorker();
    }

    // Generate at the requested scale — this is the finest zoom we can resample from
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
        scale: samplesPerPixel,
        bits: 16,
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
