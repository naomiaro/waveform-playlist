/**
 * Compute spectrogram data from an AudioBuffer.
 */

import type { SpectrogramConfig, SpectrogramData } from '@waveform-playlist/core';
import { fftMagnitudeDb } from './fft';
import { getWindowFunction } from './windowFunctions';

/**
 * Compute spectrogram for a single channel of audio.
 *
 * @param audioBuffer - Source audio buffer
 * @param config - Spectrogram configuration
 * @param offsetSamples - Start offset into the audio buffer
 * @param durationSamples - Number of samples to process
 * @param channel - Channel index (0 = left, 1 = right). Default: 0
 */
export function computeSpectrogram(
  audioBuffer: AudioBuffer,
  config: SpectrogramConfig = {},
  offsetSamples: number = 0,
  durationSamples?: number,
  channel: number = 0
): SpectrogramData {
  const windowSize = config.fftSize ?? 2048;
  const zeroPaddingFactor = config.zeroPaddingFactor ?? 2;
  const actualFftSize = windowSize * zeroPaddingFactor;
  const hopSize = config.hopSize ?? Math.floor(windowSize / 4);
  const windowName = config.windowFunction ?? 'hann';
  const gainDb = config.gainDb ?? 20;
  const rangeDb = config.rangeDb ?? 80;
  const alpha = config.alpha;

  const sampleRate = audioBuffer.sampleRate;
  const frequencyBinCount = actualFftSize >> 1;
  const totalSamples = durationSamples ?? audioBuffer.length - offsetSamples;

  // Get channel data
  const channelIdx = Math.min(channel, audioBuffer.numberOfChannels - 1);
  const channelData = audioBuffer.getChannelData(channelIdx);

  // Pre-compute window (at windowSize, not actualFftSize)
  const window = getWindowFunction(windowName, windowSize, alpha);

  // Calculate frame count (step by windowSize, not actualFftSize)
  const frameCount = Math.max(1, Math.floor((totalSamples - windowSize) / hopSize) + 1);

  // Output: frameCount × frequencyBinCount
  const data = new Float32Array(frameCount * frequencyBinCount);

  // Reusable buffers at actualFftSize
  const real = new Float32Array(actualFftSize);
  const dbBuf = new Float32Array(frequencyBinCount);

  for (let frame = 0; frame < frameCount; frame++) {
    const start = offsetSamples + frame * hopSize;

    // Fill first windowSize samples with windowed audio, rest stays zero
    for (let i = 0; i < windowSize; i++) {
      const sampleIdx = start + i;
      real[i] = sampleIdx < channelData.length ? channelData[sampleIdx] * window[i] : 0;
    }
    // Zero-pad the rest
    for (let i = windowSize; i < actualFftSize; i++) {
      real[i] = 0;
    }

    fftMagnitudeDb(real, dbBuf);
    data.set(dbBuf, frame * frequencyBinCount);
  }

  return {
    fftSize: actualFftSize,
    windowSize,
    frequencyBinCount,
    sampleRate,
    hopSize,
    frameCount,
    data,
    gainDb,
    rangeDb,
  };
}

/**
 * Compute a mono (mixed-down) spectrogram from all channels.
 */
export function computeSpectrogramMono(
  audioBuffer: AudioBuffer,
  config: SpectrogramConfig = {},
  offsetSamples: number = 0,
  durationSamples?: number
): SpectrogramData {
  if (audioBuffer.numberOfChannels === 1) {
    return computeSpectrogram(audioBuffer, config, offsetSamples, durationSamples, 0);
  }

  // Mix down channels
  const windowSize = config.fftSize ?? 2048;
  const zeroPaddingFactor = config.zeroPaddingFactor ?? 2;
  const actualFftSize = windowSize * zeroPaddingFactor;
  const hopSize = config.hopSize ?? Math.floor(windowSize / 4);
  const windowName = config.windowFunction ?? 'hann';
  const gainDb = config.gainDb ?? 20;
  const rangeDb = config.rangeDb ?? 80;
  const alpha = config.alpha;

  const sampleRate = audioBuffer.sampleRate;
  const frequencyBinCount = actualFftSize >> 1;
  const totalSamples = durationSamples ?? audioBuffer.length - offsetSamples;
  const numChannels = audioBuffer.numberOfChannels;

  const window = getWindowFunction(windowName, windowSize, alpha);
  const frameCount = Math.max(1, Math.floor((totalSamples - windowSize) / hopSize) + 1);
  const data = new Float32Array(frameCount * frequencyBinCount);
  const real = new Float32Array(actualFftSize);
  const dbBuf = new Float32Array(frequencyBinCount);

  // Get all channel data
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(audioBuffer.getChannelData(ch));
  }

  for (let frame = 0; frame < frameCount; frame++) {
    const start = offsetSamples + frame * hopSize;

    // Mix channels and apply window
    for (let i = 0; i < windowSize; i++) {
      const sampleIdx = start + i;
      let sum = 0;
      for (let ch = 0; ch < numChannels; ch++) {
        sum += sampleIdx < channels[ch].length ? channels[ch][sampleIdx] : 0;
      }
      real[i] = (sum / numChannels) * window[i];
    }
    // Zero-pad the rest
    for (let i = windowSize; i < actualFftSize; i++) {
      real[i] = 0;
    }

    fftMagnitudeDb(real, dbBuf);
    data.set(dbBuf, frame * frequencyBinCount);
  }

  return {
    fftSize: actualFftSize,
    windowSize,
    frequencyBinCount,
    sampleRate,
    hopSize,
    frameCount,
    data,
    gainDb,
    rangeDb,
  };
}
