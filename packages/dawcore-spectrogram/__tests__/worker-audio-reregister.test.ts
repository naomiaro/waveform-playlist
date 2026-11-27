import { describe, it, expect, vi, beforeAll } from 'vitest';

/**
 * New audio registered under an id that already has audio (#928).
 *
 * The FFT cache key is built from the clip id and the FFT parameters, not from
 * the audio, so the cache entries of an id describe the audio that was
 * registered when they were computed. Registering different audio under the id
 * must make the next `compute-fft` with the same parameters compute the new
 * audio, also when a computation of the old audio is still running.
 *
 * Drives the real worker module as `worker-render-mapping.test.ts` does.
 */

interface CapturedImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

type Posted = { id: string; type: string; cacheKey?: string; error?: string };

const posted: Posted[] = [];
let handler: (e: { data: unknown }) => void;

const SAMPLE_RATE = 8000;
const FFT_CONFIG = { fftSize: 256, zeroPaddingFactor: 1 };
const CANVAS_WIDTH = 10;

let requestCounter = 0;

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
  return { width: 0, height: 0, getContext: () => ctx };
}

function grayscaleIdentityLUT(): Uint8Array {
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    lut[i * 3] = lut[i * 3 + 1] = lut[i * 3 + 2] = i;
  }
  return lut;
}

function noise(length: number): Float32Array {
  const channel = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    channel[i] = Math.sin(i * 1.234) * Math.sin(i * 0.517) > 0 ? 0.9 : -0.9;
  }
  return channel;
}

function register(clipId: string, channel: Float32Array): void {
  handler({
    data: {
      type: 'register-audio-data',
      clipId,
      channelDataArrays: [channel],
      sampleRate: SAMPLE_RATE,
    },
  });
}

function unregister(clipId: string): void {
  handler({ data: { type: 'unregister-audio-data', clipId } });
}

/** Sends a `compute-fft` that reads the registered audio; returns its request id. */
function sendCompute(clipId: string, durationSamples: number): string {
  const id = 'fft-' + ++requestCounter;
  handler({
    data: {
      type: 'compute-fft',
      id,
      generation: 0,
      clipId,
      channelDataArrays: [], // empty: use the registered audio
      config: FFT_CONFIG,
      sampleRate: SAMPLE_RATE,
      offsetSamples: 0,
      durationSamples,
      mono: false,
    },
  });
  return id;
}

async function responseTo(id: string): Promise<Posted> {
  for (let i = 0; i < 500; i++) {
    const found = posted.find((m) => m.id === id);
    if (found) return found;
    await new Promise((r) => setTimeout(r, 2));
  }
  throw new Error('no response to ' + id);
}

/** Renders the cache entry onto a fresh canvas; returns the brightest red value drawn. */
function renderBrightestRed(clipId: string, cacheKey: string, durationSamples: number): number {
  const renderId = 'render-' + ++requestCounter;
  const canvasId = clipId + '-ch0-chunk0-' + renderId;
  const captured: { img: CapturedImage | null } = { img: null };
  handler({ data: { type: 'register-canvas', canvasId, canvas: makeMockCanvas(captured) } });
  handler({
    data: {
      type: 'render-chunks',
      id: renderId,
      generation: 0,
      cacheKey,
      canvasIds: [canvasId],
      canvasWidths: [CANVAS_WIDTH],
      globalPixelOffsets: [0],
      canvasHeight: 8,
      devicePixelRatio: 1,
      samplesPerPixel: durationSamples / CANVAS_WIDTH,
      colorLUT: grayscaleIdentityLUT(),
      frequencyScale: 'linear',
      minFrequency: 0,
      maxFrequency: 0,
      gainDb: 20,
      rangeDb: 80,
      channelIndex: 0,
    },
  });
  const response = posted.find((m) => m.id === renderId);
  expect(response?.type, response?.error).toBe('done');
  const { data } = captured.img!;
  let maxRed = 0;
  for (let i = 0; i < data.length; i += 4) maxRed = Math.max(maxRed, data[i]);
  return maxRed;
}

beforeAll(async () => {
  (self as unknown as { postMessage: (msg: unknown) => void }).postMessage = (msg: unknown) => {
    posted.push(msg as Posted);
  };
  await import('../src/worker/spectrogram.worker');
  handler = self.onmessage as unknown as (e: { data: unknown }) => void;
  expect(typeof handler).toBe('function');
});

describe('spectrogram worker — new audio under a registered id (#928)', () => {
  it('silence registered over noise under one id draws a dark canvas', async () => {
    const clipId = 'reregistered-clip';
    const duration = 4000;

    register(clipId, noise(duration));
    const first = await responseTo(sendCompute(clipId, duration));
    expect(first.type, first.error).toBe('cache-key');
    // Control: the noise draws bright, so a dark canvas below means silence.
    expect(renderBrightestRed(clipId, first.cacheKey!, duration)).toBeGreaterThan(100);

    register(clipId, new Float32Array(duration));
    const second = await responseTo(sendCompute(clipId, duration));
    expect(second.type, second.error).toBe('cache-key');
    expect(renderBrightestRed(clipId, second.cacheKey!, duration)).toBe(0);
  });

  // Long enough that the computation yields to the message queue (every 2000
  // frames, 64-sample hop) before it finishes: the messages sent right after
  // `compute-fft` arrive while it waits.
  const LONG_DURATION = 200_000;

  const replacements: Array<{ name: string; replace: (clipId: string) => void }> = [
    {
      name: 'unregistered and registered again',
      replace: (clipId) => {
        unregister(clipId);
        register(clipId, new Float32Array(LONG_DURATION));
      },
    },
    {
      name: 'registered again',
      replace: (clipId) => register(clipId, new Float32Array(LONG_DURATION)),
    },
  ];

  it.each(replacements)(
    'a computation of the old audio still running when the id is $name does not leave the old spectrum in the cache',
    async ({ name, replace }) => {
      const clipId = 'in-flight-clip-' + name.replace(/\s+/g, '-');

      register(clipId, noise(LONG_DURATION));
      const staleId = sendCompute(clipId, LONG_DURATION);
      // The computation is waiting at its first yield: it has not answered.
      expect(posted.find((m) => m.id === staleId)).toBeUndefined();
      replace(clipId);

      // It computed the audio that was replaced: it answers as superseded,
      // with no cache key for that audio.
      const stale = await responseTo(staleId);
      expect(stale.type).toBe('aborted');

      const fresh = await responseTo(sendCompute(clipId, LONG_DURATION));
      expect(fresh.type, fresh.error).toBe('cache-key');
      expect(renderBrightestRed(clipId, fresh.cacheKey!, LONG_DURATION)).toBe(0);
    }
  );
});
