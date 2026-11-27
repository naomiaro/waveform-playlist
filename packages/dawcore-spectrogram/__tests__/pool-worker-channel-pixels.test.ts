import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createSpectrogramWorkerPool } from '../src/worker/createSpectrogramWorkerPool';
import { ackComputeFFTs, createMockNativeWorker, respondToWorker } from './helpers/poolTestUtils';

/**
 * Channel 1 through the real pool into the real worker module (#925).
 *
 * The pool's worker 1 is wired to the worker module (the
 * `worker-render-mapping.test.ts` pattern): every message the pool sends it is
 * handled by `self.onmessage`, and every reply goes back to the pool's client.
 * Channel 0 is silence and channel 1 is noise, so worker 1 draws a bright
 * canvas only if it holds channel 1 and computes it.
 */

interface CapturedImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

let handler: (e: { data: unknown }) => void;
let replyTo: Worker | null = null;
/** Every reply the worker module posted, in order. */
const replies: Array<Record<string, unknown>> = [];

function makeMockCanvas(captured: { img: CapturedImage | null }): OffscreenCanvas {
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
  return { width: 0, height: 0, getContext: () => ctx } as unknown as OffscreenCanvas;
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
    replies.push(msg as Record<string, unknown>);
    if (replyTo) respondToWorker(replyTo, msg as Record<string, unknown>);
  };
  await import('../src/worker/spectrogram.worker');
  handler = self.onmessage as unknown as (e: { data: unknown }) => void;
  expect(typeof handler).toBe('function');
});

describe('worker pool + worker module — channel 1 of a stereo clip (#925)', () => {
  it('worker 1 renders channel 1 from the one channel it holds', async () => {
    const workers: Worker[] = [];
    const pool = createSpectrogramWorkerPool(() => {
      const w = createMockNativeWorker();
      if (workers.length === 1) {
        (w as unknown as { postMessage: (msg: unknown) => void }).postMessage = vi.fn(
          (msg: unknown) => handler({ data: msg })
        );
        replyTo = w;
      }
      workers.push(w);
      return w;
    }, 2);

    const sampleRate = 8000;
    const length = 4000;
    const silent = new Float32Array(length);
    const loud = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      loud[i] = Math.sin(i * 1.234) * Math.sin(i * 0.517) > 0 ? 0.9 : -0.9;
    }
    pool.registerAudioData('clip', [silent, loud], sampleRate);

    const fft = pool.computeFFT(
      {
        clipId: 'clip',
        channelDataArrays: [],
        config: { fftSize: 256, zeroPaddingFactor: 1 },
        sampleRate,
        offsetSamples: 0,
        durationSamples: length,
        mono: false,
        sampleRange: { start: 0, end: length },
      },
      0
    );
    ackComputeFFTs(workers[0]);
    await fft;
    // The pool resolves with worker 0's (faked) key; render with the key the
    // worker module made for channel 1.
    const cacheKey = replies.find((m) => m.type === 'cache-key')?.cacheKey as string;
    expect(cacheKey).toBeTruthy();

    const captured: { img: CapturedImage | null } = { img: null };
    pool.registerCanvas('clip-ch1-chunk0', makeMockCanvas(captured));

    await pool.renderChunks(
      {
        cacheKey,
        canvasIds: ['clip-ch1-chunk0'],
        canvasWidths: [10],
        globalPixelOffsets: [0],
        canvasHeight: 8,
        devicePixelRatio: 1,
        samplesPerPixel: 400,
        colorLUT: grayscaleIdentityLUT(),
        frequencyScale: 'mel',
        minFrequency: 0,
        maxFrequency: 0,
        gainDb: 20,
        rangeDb: 80,
        channelIndex: 1,
      },
      0
    );

    expect(captured.img).not.toBeNull();
    const { data, width, height } = captured.img!;
    for (let x = 0; x < width; x++) {
      let maxRed = 0;
      for (let y = 0; y < height; y++) {
        maxRed = Math.max(maxRed, data[(y * width + x) * 4]);
      }
      expect(maxRed, 'column ' + x + ' should show channel 1 (noise)').toBeGreaterThan(100);
    }
  });
});
