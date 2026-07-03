import { describe, it, expect, vi, beforeAll } from 'vitest';

/**
 * End-to-end pixel→audio mapping through the real worker module (#554).
 *
 * Scenario: an audio file whose first half is silence and second half is
 * full-scale noise. The clip is trimmed to the loud second half
 * (offsetSamples = 4000). Rendering the clip must show the LOUD region —
 * the file sample displayed at clip pixel x is offsetSamples + x·spp.
 *
 * The worker module registers `self.onmessage` at import time; we drive it
 * by invoking that handler directly and capturing `self.postMessage`.
 */

interface CapturedImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const posted: Array<{ id: string; type: string; cacheKey?: string; error?: string }> = [];
let handler: (e: { data: unknown }) => void;

function makeMockCanvas(captured: { img: CapturedImage | null }): unknown {
  const ctx = {
    resetTransform: vi.fn(),
    clearRect: vi.fn(),
    imageSmoothingEnabled: false,
    createImageData: (w: number, h: number): CapturedImage => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
    putImageData: (img: CapturedImage) => {
      captured.img = img;
    },
    drawImage: vi.fn(),
  };
  return {
    width: 0,
    height: 0,
    getContext: () => ctx,
  };
}

function grayscaleIdentityLUT(): Uint8Array {
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    lut[i * 3] = lut[i * 3 + 1] = lut[i * 3 + 2] = i;
  }
  return lut;
}

beforeAll(async () => {
  (self as unknown as { postMessage: (msg: unknown) => void }).postMessage = (msg: unknown) => {
    posted.push(msg as (typeof posted)[number]);
  };
  await import('../src/worker/spectrogram.worker');
  handler = self.onmessage as unknown as (e: { data: unknown }) => void;
  expect(typeof handler).toBe('function');
});

describe('spectrogram worker — render mapping honors clip offsetSamples (#554)', () => {
  it('a clip trimmed to the loud half of a file renders loud columns, not the silent half', async () => {
    const sampleRate = 8000;
    const fileLength = 8000;
    const offsetSamples = 4000;
    const durationSamples = 4000;

    // Deterministic full-scale "noise" in the second half only.
    const channel = new Float32Array(fileLength);
    for (let i = offsetSamples; i < fileLength; i++) {
      channel[i] = Math.sin(i * 1.234) * Math.sin(i * 0.517) > 0 ? 0.9 : -0.9;
    }

    handler({
      data: {
        type: 'compute-fft',
        id: 'fft-1',
        generation: 0,
        clipId: 'trimmed-clip',
        channelDataArrays: [channel],
        config: { fftSize: 256, zeroPaddingFactor: 1 },
        sampleRate,
        offsetSamples,
        durationSamples,
        mono: false,
        sampleRange: { start: offsetSamples, end: offsetSamples + durationSamples },
      },
    });
    await new Promise((r) => setTimeout(r, 20));

    const fftResponse = posted.find((m) => m.id === 'fft-1');
    expect(fftResponse?.type).toBe('cache-key');
    const cacheKey = fftResponse!.cacheKey!;

    const captured: { img: CapturedImage | null } = { img: null };
    handler({
      data: {
        type: 'register-canvas',
        canvasId: 'trimmed-clip-ch0-chunk0',
        canvas: makeMockCanvas(captured),
      },
    });

    handler({
      data: {
        type: 'render-chunks',
        id: 'render-1',
        generation: 0,
        cacheKey,
        canvasIds: ['trimmed-clip-ch0-chunk0'],
        canvasWidths: [10],
        globalPixelOffsets: [0], // clip-relative: chunk 0 starts at clip pixel 0
        canvasHeight: 8,
        devicePixelRatio: 1,
        samplesPerPixel: 400, // 10 px cover the full 4000-sample clip
        colorLUT: grayscaleIdentityLUT(),
        frequencyScale: 'mel',
        minFrequency: 0,
        maxFrequency: 0, // 0 → sampleRate / 2
        gainDb: 20,
        rangeDb: 80,
        channelIndex: 0,
      },
    });

    const renderResponse = posted.find((m) => m.id === 'render-1');
    expect(renderResponse?.type).toBe('done');
    expect(captured.img).not.toBeNull();

    const { data, width, height } = captured.img!;
    // Every pixel column displays part of the loud region → at least one
    // bright pixel per column. Under the pre-fix mapping (pixel·spp −
    // fftStartSample, ignoring offsetSamples) every column computes a
    // negative frame index and the whole canvas stays black.
    for (let x = 0; x < width; x++) {
      let maxRed = 0;
      for (let y = 0; y < height; y++) {
        maxRed = Math.max(maxRed, data[(y * width + x) * 4]);
      }
      expect(maxRed, 'column ' + x + ' should show the loud trimmed region').toBeGreaterThan(100);
    }
  });
});

describe('spectrogram worker — linear frequency scale (#557)', () => {
  it('paints the full canvas including the top row (no transparent stripe)', async () => {
    const sampleRate = 8000;
    const channel = new Float32Array(4000);
    for (let i = 0; i < channel.length; i++) {
      channel[i] = Math.sin(i * 1.234) * Math.sin(i * 0.517) > 0 ? 0.9 : -0.9;
    }

    handler({
      data: {
        type: 'compute-fft',
        id: 'fft-linear',
        generation: 0,
        clipId: 'linear-clip',
        channelDataArrays: [channel],
        config: { fftSize: 256, zeroPaddingFactor: 1 },
        sampleRate,
        offsetSamples: 0,
        durationSamples: 4000,
        mono: false,
      },
    });
    await new Promise((r) => setTimeout(r, 20));

    const fftResponse = posted.find((m) => m.id === 'fft-linear');
    expect(fftResponse?.type).toBe('cache-key');

    const captured: { img: CapturedImage | null } = { img: null };
    handler({
      data: {
        type: 'register-canvas',
        canvasId: 'linear-clip-ch0-chunk0',
        canvas: makeMockCanvas(captured),
      },
    });

    handler({
      data: {
        type: 'render-chunks',
        id: 'render-linear',
        generation: 0,
        cacheKey: fftResponse!.cacheKey!,
        canvasIds: ['linear-clip-ch0-chunk0'],
        canvasWidths: [10],
        globalPixelOffsets: [0],
        canvasHeight: 8,
        devicePixelRatio: 1,
        samplesPerPixel: 400,
        colorLUT: grayscaleIdentityLUT(),
        frequencyScale: 'linear',
        minFrequency: 0,
        maxFrequency: 0,
        gainDb: 20,
        rangeDb: 80,
        channelIndex: 0,
      },
    });

    expect(posted.find((m) => m.id === 'render-linear')?.type).toBe('done');
    const { data, width } = captured.img!;
    // Top row (y = 0) must be opaque — pre-fix, normalizedY = 1 mapped to
    // bin === frequencyBinCount, was skipped, and the row stayed transparent.
    for (let x = 0; x < width; x++) {
      expect(data[x * 4 + 3], 'top-row alpha at column ' + x).toBe(255);
    }
  });
});
