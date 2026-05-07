import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSpectrogramWorker, SpectrogramAbortError } from '../worker/createSpectrogramWorker';
import type { SpectrogramWorkerApi } from '../worker/createSpectrogramWorker';

/** Minimal mock Worker that captures postMessage calls and exposes onmessage. */
function createMockWorker() {
  const messages: unknown[] = [];
  const worker = {
    postMessage: vi.fn((...args: unknown[]) => {
      messages.push(args[0]);
    }),
    terminate: vi.fn(),
    onmessage: null as ((e: MessageEvent) => void) | null,
    onerror: null as ((e: ErrorEvent) => void) | null,
  };
  return { worker: worker as unknown as Worker, messages };
}

/** Simulate a worker response by calling onmessage. */
function respond(worker: unknown, data: Record<string, unknown>) {
  const w = worker as { onmessage: ((e: { data: unknown }) => void) | null };
  w.onmessage?.({ data } as MessageEvent);
}

describe('SpectrogramAbortError', () => {
  it('is an instance of Error', () => {
    const err = new SpectrogramAbortError();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(SpectrogramAbortError);
  });

  it('has name "SpectrogramAbortError" and message "aborted"', () => {
    const err = new SpectrogramAbortError();
    expect(err.name).toBe('SpectrogramAbortError');
    expect(err.message).toBe('aborted');
  });

  it('can be distinguished from regular Error via instanceof', () => {
    const abort = new SpectrogramAbortError();
    const regular = new Error('aborted');
    expect(abort instanceof SpectrogramAbortError).toBe(true);
    expect(regular instanceof SpectrogramAbortError).toBe(false);
  });
});

describe('createSpectrogramWorker', () => {
  let mockWorker: ReturnType<typeof createMockWorker>;
  let api: SpectrogramWorkerApi;

  beforeEach(() => {
    mockWorker = createMockWorker();
    api = createSpectrogramWorker(mockWorker.worker);
  });

  describe('computeFFT', () => {
    it('resolves with cacheKey on cache-key response', async () => {
      const promise = api.computeFFT({
        clipId: 'clip1',
        channelDataArrays: [new Float32Array(100)],
        config: {},
        sampleRate: 44100,
        offsetSamples: 0,
        durationSamples: 100,
        mono: false,
      });

      // Extract the message ID from the posted message
      const msg = mockWorker.messages[0] as { id: string; type: string };
      expect(msg.type).toBe('compute-fft');

      respond(mockWorker.worker, { id: msg.id, type: 'cache-key', cacheKey: 'key-123' });

      const result = await promise;
      expect(result).toEqual({ cacheKey: 'key-123' });
    });

    it('rejects with SpectrogramAbortError on aborted response', async () => {
      const promise = api.computeFFT({
        clipId: 'clip1',
        channelDataArrays: [new Float32Array(10)],
        config: {},
        sampleRate: 44100,
        offsetSamples: 0,
        durationSamples: 10,
        mono: false,
      });

      const msg = mockWorker.messages[0] as { id: string };
      respond(mockWorker.worker, { id: msg.id, type: 'aborted' });

      await expect(promise).rejects.toBeInstanceOf(SpectrogramAbortError);
    });

    it('rejects with Error on error response', async () => {
      const promise = api.computeFFT({
        clipId: 'clip1',
        channelDataArrays: [new Float32Array(10)],
        config: {},
        sampleRate: 44100,
        offsetSamples: 0,
        durationSamples: 10,
        mono: false,
      });

      const msg = mockWorker.messages[0] as { id: string };
      respond(mockWorker.worker, { id: msg.id, type: 'error', error: 'FFT failed' });

      await expect(promise).rejects.toThrow('FFT failed');
    });

    it('passes generation parameter in message', () => {
      api.computeFFT(
        {
          clipId: 'clip1',
          channelDataArrays: [new Float32Array(10)],
          config: {},
          sampleRate: 44100,
          offsetSamples: 0,
          durationSamples: 10,
          mono: false,
        },
        42
      );

      const msg = mockWorker.messages[0] as { generation: number };
      expect(msg.generation).toBe(42);
    });

    it('defaults generation to 0', () => {
      api.computeFFT({
        clipId: 'clip1',
        channelDataArrays: [new Float32Array(10)],
        config: {},
        sampleRate: 44100,
        offsetSamples: 0,
        durationSamples: 10,
        mono: false,
      });

      const msg = mockWorker.messages[0] as { generation: number };
      expect(msg.generation).toBe(0);
    });

    it('passes channelFilter when provided', () => {
      api.computeFFT({
        clipId: 'clip1',
        channelDataArrays: [new Float32Array(10)],
        config: {},
        sampleRate: 44100,
        offsetSamples: 0,
        durationSamples: 10,
        mono: false,
        channelFilter: 1,
      });

      const msg = mockWorker.messages[0] as { channelFilter?: number };
      expect(msg.channelFilter).toBe(1);
    });

    it('omits channelFilter when not provided', () => {
      api.computeFFT({
        clipId: 'clip1',
        channelDataArrays: [new Float32Array(10)],
        config: {},
        sampleRate: 44100,
        offsetSamples: 0,
        durationSamples: 10,
        mono: false,
      });

      const msg = mockWorker.messages[0] as Record<string, unknown>;
      expect('channelFilter' in msg).toBe(false);
    });
  });

  describe('renderChunks', () => {
    it('resolves on done response', async () => {
      const promise = api.renderChunks({
        cacheKey: 'key-123',
        canvasIds: ['clip1-ch0-chunk0'],
        canvasWidths: [1000],
        globalPixelOffsets: [0],
        canvasHeight: 80,
        devicePixelRatio: 1,
        samplesPerPixel: 1024,
        colorLUT: new Uint8Array(768),
        frequencyScale: 'mel',
        minFrequency: 0,
        maxFrequency: 22050,
        gainDb: 20,
        rangeDb: 80,
        channelIndex: 0,
      });

      const msg = mockWorker.messages[0] as { id: string; type: string };
      expect(msg.type).toBe('render-chunks');

      respond(mockWorker.worker, { id: msg.id, type: 'done' });

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('audio data pre-registration', () => {
    it('skips transfer for pre-registered clip', () => {
      // Register audio data first
      api.registerAudioData('clip1', [new Float32Array(100)], 44100);

      // Now computeFFT should not transfer arrays (empty transferables)
      api.computeFFT({
        clipId: 'clip1',
        channelDataArrays: [new Float32Array(100)],
        config: {},
        sampleRate: 44100,
        offsetSamples: 0,
        durationSamples: 100,
        mono: false,
      });

      // The compute-fft call is the second postMessage (after register-audio-data)
      const computeCall = vi.mocked(mockWorker.worker.postMessage).mock.calls[1];
      const transferables = computeCall[1] as ArrayBuffer[];
      expect(transferables).toEqual([]);
    });

    it('transfers arrays for unregistered clip', () => {
      api.computeFFT({
        clipId: 'unregistered',
        channelDataArrays: [new Float32Array(100)],
        config: {},
        sampleRate: 44100,
        offsetSamples: 0,
        durationSamples: 100,
        mono: false,
      });

      const computeCall = vi.mocked(mockWorker.worker.postMessage).mock.calls[0];
      const transferables = computeCall[1] as ArrayBuffer[];
      expect(transferables.length).toBe(1);
      expect(transferables[0]).toBeInstanceOf(ArrayBuffer);
    });

    it('resumes transfer after unregisterAudioData', () => {
      api.registerAudioData('clip1', [new Float32Array(100)], 44100);
      api.unregisterAudioData('clip1');

      api.computeFFT({
        clipId: 'clip1',
        channelDataArrays: [new Float32Array(100)],
        config: {},
        sampleRate: 44100,
        offsetSamples: 0,
        durationSamples: 100,
        mono: false,
      });

      // register + unregister + computeFFT = 3 calls
      const computeCall = vi.mocked(mockWorker.worker.postMessage).mock.calls[2];
      const transferables = computeCall[1] as ArrayBuffer[];
      expect(transferables.length).toBe(1);
    });
  });

  describe('abortGeneration', () => {
    it('posts abort-generation message', () => {
      api.abortGeneration(5);
      const msg = mockWorker.messages[0] as { type: string; generation: number };
      expect(msg.type).toBe('abort-generation');
      expect(msg.generation).toBe(5);
    });
  });

  describe('registerCanvas / unregisterCanvas', () => {
    it('posts register-canvas with transfer', () => {
      const canvas = {} as OffscreenCanvas;
      api.registerCanvas('clip1-ch0-chunk0', canvas);
      const msg = mockWorker.messages[0] as { type: string; canvasId: string };
      expect(msg.type).toBe('register-canvas');
      expect(msg.canvasId).toBe('clip1-ch0-chunk0');
    });

    it('posts unregister-canvas', () => {
      api.unregisterCanvas('clip1-ch0-chunk0');
      const msg = mockWorker.messages[0] as { type: string; canvasId: string };
      expect(msg.type).toBe('unregister-canvas');
      expect(msg.canvasId).toBe('clip1-ch0-chunk0');
    });
  });

  describe('terminated state', () => {
    it('rejects computeFFT after terminate', async () => {
      api.terminate();

      await expect(
        api.computeFFT({
          clipId: 'clip1',
          channelDataArrays: [new Float32Array(10)],
          config: {},
          sampleRate: 44100,
          offsetSamples: 0,
          durationSamples: 10,
          mono: false,
        })
      ).rejects.toThrow('Worker terminated');
    });

    it('rejects renderChunks after terminate', async () => {
      api.terminate();

      await expect(
        api.renderChunks({
          cacheKey: 'key',
          canvasIds: ['c'],
          canvasWidths: [100],
          globalPixelOffsets: [0],
          canvasHeight: 80,
          devicePixelRatio: 1,
          samplesPerPixel: 1024,
          colorLUT: new Uint8Array(768),
          frequencyScale: 'mel',
          minFrequency: 0,
          maxFrequency: 22050,
          gainDb: 20,
          rangeDb: 80,
          channelIndex: 0,
        })
      ).rejects.toThrow('Worker terminated');
    });

    it('rejects all pending promises on terminate', async () => {
      const promise = api.computeFFT({
        clipId: 'clip1',
        channelDataArrays: [new Float32Array(10)],
        config: {},
        sampleRate: 44100,
        offsetSamples: 0,
        durationSamples: 10,
        mono: false,
      });

      api.terminate();

      await expect(promise).rejects.toThrow('Worker terminated');
    });

    it('does not post abortGeneration after terminate', () => {
      api.terminate();
      // Clear the terminate-related calls
      const postSpy = vi.mocked(mockWorker.worker.postMessage);
      const callCountAfterTerminate = postSpy.mock.calls.length;

      api.abortGeneration(5);
      expect(postSpy.mock.calls.length).toBe(callCountAfterTerminate);
    });
  });

  describe('worker error', () => {
    it('rejects all pending promises on worker onerror', async () => {
      const promise1 = api.computeFFT({
        clipId: 'clip1',
        channelDataArrays: [new Float32Array(10)],
        config: {},
        sampleRate: 44100,
        offsetSamples: 0,
        durationSamples: 10,
        mono: false,
      });

      const promise2 = api.renderChunks({
        cacheKey: 'key',
        canvasIds: ['c'],
        canvasWidths: [100],
        globalPixelOffsets: [0],
        canvasHeight: 80,
        devicePixelRatio: 1,
        samplesPerPixel: 1024,
        colorLUT: new Uint8Array(768),
        frequencyScale: 'mel',
        minFrequency: 0,
        maxFrequency: 22050,
        gainDb: 20,
        rangeDb: 80,
        channelIndex: 0,
      });

      // Simulate worker crash
      const w = mockWorker.worker as unknown as { onerror: (e: unknown) => void };
      w.onerror({ error: new Error('Worker crashed'), message: 'Worker crashed' });

      await expect(promise1).rejects.toThrow('Worker crashed');
      await expect(promise2).rejects.toThrow('Worker crashed');
    });
  });

  describe('multiple concurrent requests', () => {
    it('assigns unique IDs to each request', () => {
      const params = {
        clipId: 'clip1',
        channelDataArrays: [new Float32Array(10)],
        config: {},
        sampleRate: 44100,
        offsetSamples: 0,
        durationSamples: 10,
        mono: false,
      };

      api.computeFFT(params);
      api.computeFFT(params);
      api.computeFFT(params);

      const ids = mockWorker.messages.map((m) => (m as { id: string }).id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });

    it('resolves the correct promise for each response', async () => {
      const params = {
        clipId: 'clip1',
        channelDataArrays: [new Float32Array(10)],
        config: {},
        sampleRate: 44100,
        offsetSamples: 0,
        durationSamples: 10,
        mono: false,
      };

      const p1 = api.computeFFT(params);
      const p2 = api.computeFFT(params);

      const id1 = (mockWorker.messages[0] as { id: string }).id;
      const id2 = (mockWorker.messages[1] as { id: string }).id;

      // Respond out of order
      respond(mockWorker.worker, { id: id2, type: 'cache-key', cacheKey: 'second' });
      respond(mockWorker.worker, { id: id1, type: 'cache-key', cacheKey: 'first' });

      expect(await p1).toEqual({ cacheKey: 'first' });
      expect(await p2).toEqual({ cacheKey: 'second' });
    });
  });
});
