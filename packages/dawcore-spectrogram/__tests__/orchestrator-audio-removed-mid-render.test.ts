import { describe, it, expect, vi, beforeAll } from 'vitest';
import { SpectrogramOrchestrator } from '../src/orchestrator/SpectrogramOrchestrator';
import { createMockNativeWorker, respondToWorker } from './helpers/poolTestUtils';

/**
 * A clip unregistered while its FFT is being computed (#928, review of #929).
 *
 * The worker answers a computation whose clip's audio was replaced or removed
 * with `aborted`, while the orchestrator's generation stays the same. The rest
 * of the render pass must still draw: the other clips of the same track and the
 * other tracks. `unregisterClip` schedules no render of its own, so a pass that
 * stopped there would leave them black until the next viewport or config change.
 *
 * Real orchestrator, real pool, real worker module: the pool's worker 0 is wired
 * to `self.onmessage` (the `pool-worker-channel-pixels.test.ts` pattern). Every
 * clip is mono, so worker 0 does all the work.
 */

interface CapturedImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

let handler: (e: { data: unknown }) => void;
let replyTo: Worker | null = null;
const replies: Array<Record<string, unknown>> = [];
const intoModule: Array<Record<string, unknown>> = [];

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

function noise(length: number): Float32Array {
  const channel = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    channel[i] = Math.sin(i * 1.234) * Math.sin(i * 0.517) > 0 ? 0.9 : -0.9;
  }
  return channel;
}

function brightestRed(captured: { img: CapturedImage | null }): number {
  if (!captured.img) return -1;
  let max = 0;
  for (let i = 0; i < captured.img.data.length; i += 4) max = Math.max(max, captured.img.data[i]);
  return max;
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

describe('orchestrator — a clip unregistered while its FFT runs (#928)', () => {
  it('the rest of the pass still draws: the same track and the next track', async () => {
    let made = 0;
    const orchestrator = new SpectrogramOrchestrator({
      workerFactory: () => {
        const w = createMockNativeWorker();
        if (made === 0) {
          (w as unknown as { postMessage: (msg: unknown) => void }).postMessage = (
            msg: unknown
          ) => {
            intoModule.push(msg as Record<string, unknown>);
            handler({ data: msg });
          };
          replyTo = w;
        }
        made++;
        return w;
      },
      workerPoolSize: 2,
      config: { fftSize: 256, zeroPaddingFactor: 1 },
      colorMap: 'grayscale',
      devicePixelRatio: 1,
    });

    const sampleRate = 8000;
    const samplesPerPixel = 200;
    // 1000 px at 200 samples per pixel, over 2000 frames at hop 64: the
    // computation yields to the message queue before it finishes.
    const longLength = 200_000;
    const shortLength = 4000;

    const clips = [
      { clipId: 'longA', trackId: 'A', length: longLength, widthPx: 1000 },
      { clipId: 'shortA', trackId: 'A', length: shortLength, widthPx: 20 },
      { clipId: 'shortB', trackId: 'B', length: shortLength, widthPx: 20 },
    ];
    const captured = new Map<string, { img: CapturedImage | null }>();
    for (const clip of clips) {
      orchestrator.registerClip({
        clipId: clip.clipId,
        trackId: clip.trackId,
        channelData: [noise(clip.length)],
        sampleRate,
        durationSamples: clip.length,
        offsetSamples: 0,
      });
      const cap = { img: null as CapturedImage | null };
      captured.set(clip.clipId, cap);
      orchestrator.registerCanvas({
        canvasId: clip.clipId + '-ch0-chunk0',
        canvas: makeMockCanvas(cap),
        clipId: clip.clipId,
        trackId: clip.trackId,
        channelIndex: 0,
        chunkIndex: 0,
        globalPixelOffset: 0,
        widthPx: clip.widthPx,
        heightPx: 8,
      });
    }
    orchestrator.setViewport({
      visibleStartPx: 0,
      visibleEndPx: 1000,
      bufferStartPx: 0,
      bufferEndPx: 1000,
      samplesPerPixel,
    });

    // Wait until the long clip's compute is in the module, suspended at a yield.
    for (let i = 0; i < 200 && !intoModule.some((m) => m.type === 'compute-fft'); i++) {
      await Promise.resolve();
    }
    const first = intoModule.find((m) => m.type === 'compute-fft');
    // Fixture guard: the long clip is the first group of the first track, so
    // a pass that stops at its abort skips both other clips.
    expect(first?.clipId).toBe('longA');
    expect(replies.some((r) => r.id === first?.id)).toBe(false);

    // As <daw-editor> does when a clip is removed or its track leaves spectrogram mode.
    orchestrator.unregisterClip('longA');
    orchestrator.unregisterCanvas('longA-ch0-chunk0');

    for (let i = 0; i < 500; i++) {
      if (captured.get('shortA')!.img && captured.get('shortB')!.img) break;
      await new Promise((r) => setTimeout(r, 2));
    }
    expect(replies.find((r) => r.id === first?.id)?.type).toBe('aborted');
    expect(brightestRed(captured.get('shortA')!), 'the other clip of track A').toBe(255);
    expect(brightestRed(captured.get('shortB')!), 'track B').toBe(255);

    orchestrator.dispose();
  });
});
