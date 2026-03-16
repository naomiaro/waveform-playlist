/**
 * Inline Web Worker for generating WaveformData binary format from AudioBuffer channels.
 *
 * Uses a Blob URL approach (portable across all bundlers) with the generateWaveformData
 * algorithm adapted from BBC's waveform-data.js (MIT licensed, adapted from Audacity).
 *
 * The worker generates peaks at a base scale (finest zoom level). The main thread
 * then uses WaveformData.resample() for near-instant zoom changes.
 */

import WaveformData from 'waveform-data';

// ────────────────────────────────────────────────────────────────────────────
// Worker code (runs inside the Blob URL worker)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Self-contained worker source.
 * Contains the generateWaveformData function from waveform-data.js/src/waveform-generator.js
 * (MIT License, BBC). Pure JS, zero dependencies.
 */
const workerSource = `
"use strict";

var INT8_MAX = 127;
var INT8_MIN = -128;
var INT16_MAX = 32767;
var INT16_MIN = -32768;

function calculateWaveformDataLength(audio_sample_count, scale) {
  var data_length = Math.floor(audio_sample_count / scale);
  var samples_remaining = audio_sample_count - (data_length * scale);
  if (samples_remaining > 0) {
    data_length++;
  }
  return data_length;
}

function generateWaveformData(options) {
  var scale = options.scale;
  var amplitude_scale = options.amplitude_scale;
  var split_channels = options.split_channels;
  var length = options.length;
  var sample_rate = options.sample_rate;
  var channels = options.channels.map(function(channel) {
    return new Float32Array(channel);
  });
  var output_channels = split_channels ? channels.length : 1;
  var header_size = 24;
  var data_length = calculateWaveformDataLength(length, scale);
  var bytes_per_sample = options.bits === 8 ? 1 : 2;
  var total_size = header_size + data_length * 2 * bytes_per_sample * output_channels;
  var buffer = new ArrayBuffer(total_size);
  var data_view = new DataView(buffer);

  var scale_counter = 0;
  var offset = header_size;

  var min_value = new Array(output_channels);
  var max_value = new Array(output_channels);

  for (var channel = 0; channel < output_channels; channel++) {
    min_value[channel] = Infinity;
    max_value[channel] = -Infinity;
  }

  var range_min = options.bits === 8 ? INT8_MIN : INT16_MIN;
  var range_max = options.bits === 8 ? INT8_MAX : INT16_MAX;

  data_view.setInt32(0, 2, true);
  data_view.setUint32(4, options.bits === 8, true);
  data_view.setInt32(8, sample_rate, true);
  data_view.setInt32(12, scale, true);
  data_view.setInt32(16, data_length, true);
  data_view.setInt32(20, output_channels, true);

  for (var i = 0; i < length; i++) {
    var sample = 0;

    if (output_channels === 1) {
      for (var ch = 0; ch < channels.length; ++ch) {
        sample += channels[ch][i];
      }
      sample = Math.floor(range_max * sample * amplitude_scale / channels.length);

      if (sample < min_value[0]) {
        min_value[0] = sample;
        if (min_value[0] < range_min) {
          min_value[0] = range_min;
        }
      }
      if (sample > max_value[0]) {
        max_value[0] = sample;
        if (max_value[0] > range_max) {
          max_value[0] = range_max;
        }
      }
    }
    else {
      for (var ch2 = 0; ch2 < output_channels; ++ch2) {
        sample = Math.floor(range_max * channels[ch2][i] * amplitude_scale);

        if (sample < min_value[ch2]) {
          min_value[ch2] = sample;
          if (min_value[ch2] < range_min) {
            min_value[ch2] = range_min;
          }
        }
        if (sample > max_value[ch2]) {
          max_value[ch2] = sample;
          if (max_value[ch2] > range_max) {
            max_value[ch2] = range_max;
          }
        }
      }
    }

    if (++scale_counter === scale) {
      for (var ch3 = 0; ch3 < output_channels; ch3++) {
        if (options.bits === 8) {
          data_view.setInt8(offset++, min_value[ch3]);
          data_view.setInt8(offset++, max_value[ch3]);
        }
        else {
          data_view.setInt16(offset, min_value[ch3], true);
          data_view.setInt16(offset + 2, max_value[ch3], true);
          offset += 4;
        }
        min_value[ch3] = Infinity;
        max_value[ch3] = -Infinity;
      }
      scale_counter = 0;
    }
  }

  if (scale_counter > 0) {
    for (var ch4 = 0; ch4 < output_channels; ch4++) {
      if (options.bits === 8) {
        data_view.setInt8(offset++, min_value[ch4]);
        data_view.setInt8(offset++, max_value[ch4]);
      }
      else {
        data_view.setInt16(offset, min_value[ch4], true);
        data_view.setInt16(offset + 2, max_value[ch4], true);
      }
    }
  }

  return buffer;
}

self.onmessage = function(e) {
  var msg = e.data;
  try {
    var result = generateWaveformData({
      scale: msg.scale,
      bits: msg.bits,
      amplitude_scale: msg.amplitude_scale,
      split_channels: msg.split_channels,
      length: msg.length,
      sample_rate: msg.sample_rate,
      channels: msg.channels
    });
    self.postMessage({ id: msg.id, buffer: result }, [result]);
  } catch (err) {
    self.postMessage({ id: msg.id, error: err.message || String(err) });
  }
};
`;

// ────────────────────────────────────────────────────────────────────────────
// Promise-based worker API (runs on the main thread)
// ────────────────────────────────────────────────────────────────────────────

export interface PeaksWorkerApi {
  generate(params: {
    id: string;
    channels: ArrayBuffer[];
    length: number;
    sampleRate: number;
    scale: number;
    bits: 8 | 16;
    splitChannels: boolean;
  }): Promise<WaveformData>;
  terminate(): void;
}

interface PendingEntry {
  resolve: (value: WaveformData) => void;
  reject: (reason: unknown) => void;
}

let idCounter = 0;

export function createPeaksWorker(): PeaksWorkerApi {
  let worker: Worker;
  try {
    const blob = new Blob([workerSource], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    worker = new Worker(url);
    URL.revokeObjectURL(url);
  } catch (err) {
    // Worker creation can fail in CSP-restricted environments that block blob: URLs.
    // Return a no-op API that rejects all generate calls gracefully.
    console.warn('[waveform-playlist] Failed to create peaks worker (CSP restriction?):', err);
    return {
      generate() {
        return Promise.reject(new Error('Worker creation failed'));
      },
      terminate() {
        /* no-op */
      },
    };
  }

  const pending = new Map<string, PendingEntry>();
  let terminated = false;

  worker.onmessage = (e: MessageEvent) => {
    const msg = e.data;
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);

    if (msg.error) {
      entry.reject(new Error(msg.error));
    } else {
      try {
        const waveformData = WaveformData.create(msg.buffer);
        entry.resolve(waveformData);
      } catch (err) {
        entry.reject(err);
      }
    }
  };

  worker.onerror = (e: ErrorEvent) => {
    terminated = true;
    worker.terminate();
    for (const [, entry] of pending) {
      entry.reject(e.error ?? new Error(e.message));
    }
    pending.clear();
  };

  return {
    generate(params) {
      if (terminated) return Promise.reject(new Error('Worker terminated'));
      const messageId = String(++idCounter);

      return new Promise<WaveformData>((resolve, reject) => {
        pending.set(messageId, { resolve, reject });

        worker.postMessage(
          {
            id: messageId,
            scale: params.scale,
            bits: params.bits,
            amplitude_scale: 1.0,
            split_channels: params.splitChannels,
            length: params.length,
            sample_rate: params.sampleRate,
            channels: params.channels,
          },
          params.channels // Transfer ownership
        );
      });
    },

    terminate() {
      terminated = true;
      worker.terminate();
      for (const [, entry] of pending) {
        entry.reject(new Error('Worker terminated'));
      }
      pending.clear();
    },
  };
}
