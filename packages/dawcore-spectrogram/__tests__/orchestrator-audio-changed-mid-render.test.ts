import { describe, it, expect, vi, beforeAll } from 'vitest';
import { SpectrogramOrchestrator } from '../src/orchestrator/SpectrogramOrchestrator';
import { createMockNativeWorker, respondToWorker } from './helpers/poolTestUtils';

/**
 * A clip unregistered or registered again while its FFT is being computed
 * (#928, review of #929).
 *
 * The worker answers a computation whose clip's audio was replaced or removed
 * with `aborted`, while the orchestrator's generation stays the same. The rest
 * of the render pass must still draw: the other clips of the same track and the
 * other tracks (`unregisterClip` schedules no render of its own). And
 * `viewport-ready` must mean the track's viewport is drawn: for a clip
 * registered again it fires after the follow-up render that `registerClip`
 * schedules has drawn the new audio, once.
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
type Captured = { img: CapturedImage | null };

let handler: (e: { data: unknown }) => void;
let replyTo: Worker | null = null;
const replies: Array<Record<string, unknown>> = [];
const intoModule: Array<Record<string, unknown>> = [];

const SAMPLE_RATE = 8000;
const SAMPLES_PER_PIXEL = 200;
// 1000 px at 200 samples per pixel, over 2000 frames at hop 64: the
// computation yields to the message queue before it finishes.
const LONG_LENGTH = 200_000;
const SHORT_LENGTH = 4000;

function makeMockCanvas(captured: Captured): OffscreenCanvas {
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

function brightestRed(captured: Captured): number {
  if (!captured.img) return -1;
  let max = 0;
  for (let i = 0; i < captured.img.data.length; i += 4) max = Math.max(max, captured.img.data[i]);
  return max;
}

function makeOrchestrator(): SpectrogramOrchestrator {
  let made = 0;
  return new SpectrogramOrchestrator({
    workerFactory: () => {
      const w = createMockNativeWorker();
      if (made === 0) {
        (w as unknown as { postMessage: (msg: unknown) => void }).postMessage = (msg: unknown) => {
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
}

interface ClipSpec {
  clipId: string;
  trackId: string;
  length: number;
}

function registerAudio(o: SpectrogramOrchestrator, clip: ClipSpec, audio: Float32Array): void {
  o.registerClip({
    clipId: clip.clipId,
    trackId: clip.trackId,
    channelData: [audio],
    sampleRate: SAMPLE_RATE,
    durationSamples: clip.length,
    offsetSamples: 0,
  });
}

/** Registers each clip's noise and one canvas; returns the canvases' captures. */
function addClips(o: SpectrogramOrchestrator, clips: ClipSpec[]): Map<string, Captured> {
  const captured = new Map<string, Captured>();
  for (const clip of clips) {
    registerAudio(o, clip, noise(clip.length));
    const cap: Captured = { img: null };
    captured.set(clip.clipId, cap);
    o.registerCanvas({
      canvasId: clip.clipId + '-ch0-chunk0',
      canvas: makeMockCanvas(cap),
      clipId: clip.clipId,
      trackId: clip.trackId,
      channelIndex: 0,
      chunkIndex: 0,
      globalPixelOffset: 0,
      widthPx: Math.ceil(clip.length / SAMPLES_PER_PIXEL),
      heightPx: 8,
    });
  }
  o.setViewport({
    visibleStartPx: 0,
    visibleEndPx: 1000,
    bufferStartPx: 0,
    bufferEndPx: 1000,
    samplesPerPixel: SAMPLES_PER_PIXEL,
  });
  return captured;
}

/** The first compute-fft sent from `fromIndex` on, once it is in the module and unanswered. */
async function suspendedCompute(fromIndex: number): Promise<Record<string, unknown>> {
  const sent = () => intoModule.slice(fromIndex).find((m) => m.type === 'compute-fft');
  for (let i = 0; i < 200 && !sent(); i++) await Promise.resolve();
  const compute = sent();
  expect(compute, 'a compute-fft reached the worker module').toBeDefined();
  expect(replies.some((r) => r.id === compute!.id)).toBe(false);
  return compute!;
}

async function settle(done: () => boolean): Promise<void> {
  for (let i = 0; i < 500 && !done(); i++) await new Promise((r) => setTimeout(r, 2));
  // Room for anything that would come after (a second event, a late draw).
  await new Promise((r) => setTimeout(r, 50));
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
    const orchestrator = makeOrchestrator();
    const readyTracks: string[] = [];
    orchestrator.addEventListener('viewport-ready', (e) => {
      readyTracks.push((e as CustomEvent<{ trackId: string }>).detail.trackId);
    });
    const fromIndex = intoModule.length;
    const captured = addClips(orchestrator, [
      { clipId: 'removed-longA', trackId: 'removed-A', length: LONG_LENGTH },
      { clipId: 'removed-shortA', trackId: 'removed-A', length: SHORT_LENGTH },
      { clipId: 'removed-shortB', trackId: 'removed-B', length: SHORT_LENGTH },
    ]);

    const first = await suspendedCompute(fromIndex);
    // Fixture guard: the long clip is the first group of the first track, so
    // a pass that stops at its abort skips both other clips.
    expect(first.clipId).toBe('removed-longA');

    // As <daw-editor> does when a clip is removed or its track leaves spectrogram mode.
    orchestrator.unregisterClip('removed-longA');
    orchestrator.unregisterCanvas('removed-longA-ch0-chunk0');

    await settle(() => readyTracks.length >= 2);
    expect(replies.find((r) => r.id === first.id)?.type).toBe('aborted');
    expect(brightestRed(captured.get('removed-shortA')!), 'the other clip of track A').toBe(255);
    expect(brightestRed(captured.get('removed-shortB')!), 'track B').toBe(255);
    // Nothing will draw the removed clip, and no render follows an
    // unregister: the track is ready in this pass.
    expect(readyTracks).toEqual(['removed-A', 'removed-B']);

    orchestrator.dispose();
  });
});

describe('orchestrator — a clip registered again while its FFT runs (#928)', () => {
  it('viewport-ready fires once, after the new audio is drawn', async () => {
    const orchestrator = makeOrchestrator();
    const clip: ClipSpec = { clipId: 'replaced-long', trackId: 'replaced-A', length: LONG_LENGTH };
    const fromIndex = intoModule.length;
    const captured = addClips(orchestrator, [clip]);
    const canvas = captured.get(clip.clipId)!;
    const redAtReady: number[] = [];
    orchestrator.addEventListener('viewport-ready', () => redAtReady.push(brightestRed(canvas)));

    const first = await suspendedCompute(fromIndex);
    expect(first.clipId).toBe(clip.clipId);

    registerAudio(orchestrator, clip, new Float32Array(LONG_LENGTH));

    await settle(() => redAtReady.length >= 1 && brightestRed(canvas) === 0);
    expect(replies.find((r) => r.id === first.id)?.type).toBe('aborted');
    expect(brightestRed(canvas), 'the canvas shows the new audio (silence)').toBe(0);
    // One event, and the canvas held the new audio when it fired (-1 would
    // mean nothing was drawn yet).
    expect(redAtReady).toEqual([0]);

    orchestrator.dispose();
  });
});
