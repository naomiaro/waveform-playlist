import { describe, it, expect, vi } from 'vitest';
import { createSpectrogramWorkerPool } from '../src/worker/createSpectrogramWorkerPool';

function createMockNativeWorker() {
  const worker = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null as ((e: MessageEvent) => void) | null,
    onerror: null as ((e: ErrorEvent) => void) | null,
  };
  return worker as unknown as Worker;
}

function respondToWorker(worker: unknown, data: Record<string, unknown>) {
  const w = worker as { onmessage: ((e: { data: unknown }) => void) | null };
  w.onmessage?.({ data } as MessageEvent);
}

describe('createSpectrogramWorkerPool', () => {
  describe('pool creation', () => {
    it('creates the requested number of workers', () => {
      const factory = vi.fn(() => createMockNativeWorker());
      createSpectrogramWorkerPool(factory, 3);
      expect(factory).toHaveBeenCalledTimes(3);
    });

    it('defaults to pool size 2', () => {
      const factory = vi.fn(() => createMockNativeWorker());
      createSpectrogramWorkerPool(factory);
      expect(factory).toHaveBeenCalledTimes(2);
    });

    it('cleans up already-created workers if factory throws mid-creation', () => {
      const createdWorkers: ReturnType<typeof createMockNativeWorker>[] = [];
      let callCount = 0;
      const factory = vi.fn(() => {
        callCount++;
        if (callCount === 3) throw new Error('Worker creation failed');
        const w = createMockNativeWorker();
        createdWorkers.push(w);
        return w;
      });

      expect(() => createSpectrogramWorkerPool(factory, 3)).toThrow('Worker creation failed');
      // 2 workers were created before the 3rd failed — both should be terminated
      // The pool calls terminate() on the SpectrogramWorkerApi wrapper, which calls worker.terminate()
      for (const w of createdWorkers) {
        expect(
          (w as unknown as { terminate: ReturnType<typeof vi.fn> }).terminate
        ).toHaveBeenCalled();
      }
    });
  });

  describe('registerAudioData / unregisterAudioData', () => {
    it('broadcasts registerAudioData to all workers', () => {
      const nativeWorkers: ReturnType<typeof createMockNativeWorker>[] = [];
      const pool = createSpectrogramWorkerPool(() => {
        const w = createMockNativeWorker();
        nativeWorkers.push(w);
        return w;
      }, 3);

      const data = [new Float32Array(100)];
      pool.registerAudioData('clip1', data, 44100);

      for (const w of nativeWorkers) {
        const calls = (w as unknown as { postMessage: ReturnType<typeof vi.fn> }).postMessage.mock
          .calls;
        const registerCall = calls.find(
          (c: unknown[]) => (c[0] as { type: string }).type === 'register-audio-data'
        );
        expect(registerCall).toBeTruthy();
        expect((registerCall![0] as { clipId: string }).clipId).toBe('clip1');
      }
    });

    it('broadcasts unregisterAudioData to all workers', () => {
      const nativeWorkers: ReturnType<typeof createMockNativeWorker>[] = [];
      const pool = createSpectrogramWorkerPool(() => {
        const w = createMockNativeWorker();
        nativeWorkers.push(w);
        return w;
      }, 2);

      pool.unregisterAudioData('clip1');

      for (const w of nativeWorkers) {
        const calls = (w as unknown as { postMessage: ReturnType<typeof vi.fn> }).postMessage.mock
          .calls;
        const unregisterCall = calls.find(
          (c: unknown[]) => (c[0] as { type: string }).type === 'unregister-audio-data'
        );
        expect(unregisterCall).toBeTruthy();
      }
    });
  });

  describe('registerCanvas / unregisterCanvas routing', () => {
    it('routes canvas to correct worker based on channel in canvas ID', () => {
      const nativeWorkers: ReturnType<typeof createMockNativeWorker>[] = [];
      const pool = createSpectrogramWorkerPool(() => {
        const w = createMockNativeWorker();
        nativeWorkers.push(w);
        return w;
      }, 2);

      const canvas0 = {} as OffscreenCanvas;
      const canvas1 = {} as OffscreenCanvas;

      pool.registerCanvas('clip1-ch0-chunk5', canvas0);
      pool.registerCanvas('clip1-ch1-chunk5', canvas1);

      // ch0 → worker 0
      const w0Calls = (nativeWorkers[0] as unknown as { postMessage: ReturnType<typeof vi.fn> })
        .postMessage.mock.calls;
      const w0Register = w0Calls.find(
        (c: unknown[]) => (c[0] as { type: string }).type === 'register-canvas'
      );
      expect(w0Register).toBeTruthy();
      expect((w0Register![0] as { canvasId: string }).canvasId).toBe('clip1-ch0-chunk5');

      // ch1 → worker 1
      const w1Calls = (nativeWorkers[1] as unknown as { postMessage: ReturnType<typeof vi.fn> })
        .postMessage.mock.calls;
      const w1Register = w1Calls.find(
        (c: unknown[]) => (c[0] as { type: string }).type === 'register-canvas'
      );
      expect(w1Register).toBeTruthy();
      expect((w1Register![0] as { canvasId: string }).canvasId).toBe('clip1-ch1-chunk5');
    });

    it('wraps channel index with modulo for pools smaller than channel count', () => {
      const nativeWorkers: ReturnType<typeof createMockNativeWorker>[] = [];
      const pool = createSpectrogramWorkerPool(() => {
        const w = createMockNativeWorker();
        nativeWorkers.push(w);
        return w;
      }, 2);

      // ch2 % 2 = worker 0
      pool.registerCanvas('clip1-ch2-chunk0', {} as OffscreenCanvas);

      const w0Calls = (nativeWorkers[0] as unknown as { postMessage: ReturnType<typeof vi.fn> })
        .postMessage.mock.calls;
      const registerCall = w0Calls.find(
        (c: unknown[]) => (c[0] as { type: string }).type === 'register-canvas'
      );
      expect(registerCall).toBeTruthy();
    });

    it('defaults to worker 0 for canvas IDs without channel marker', () => {
      const nativeWorkers: ReturnType<typeof createMockNativeWorker>[] = [];
      const pool = createSpectrogramWorkerPool(() => {
        const w = createMockNativeWorker();
        nativeWorkers.push(w);
        return w;
      }, 2);

      pool.registerCanvas('some-weird-id', {} as OffscreenCanvas);

      const w0Calls = (nativeWorkers[0] as unknown as { postMessage: ReturnType<typeof vi.fn> })
        .postMessage.mock.calls;
      const registerCall = w0Calls.find(
        (c: unknown[]) => (c[0] as { type: string }).type === 'register-canvas'
      );
      expect(registerCall).toBeTruthy();
    });
  });

  describe('computeFFT', () => {
    it('sends to single worker in mono mode', () => {
      const nativeWorkers: ReturnType<typeof createMockNativeWorker>[] = [];
      const pool = createSpectrogramWorkerPool(() => {
        const w = createMockNativeWorker();
        nativeWorkers.push(w);
        return w;
      }, 2);

      pool.computeFFT({
        clipId: 'clip1',
        channelDataArrays: [new Float32Array(10), new Float32Array(10)],
        config: {},
        sampleRate: 44100,
        offsetSamples: 0,
        durationSamples: 10,
        mono: true,
      });

      // Only worker 0 should receive compute-fft
      const w0Calls = (nativeWorkers[0] as unknown as { postMessage: ReturnType<typeof vi.fn> })
        .postMessage.mock.calls;
      const w1Calls = (nativeWorkers[1] as unknown as { postMessage: ReturnType<typeof vi.fn> })
        .postMessage.mock.calls;

      expect(
        w0Calls.some((c: unknown[]) => (c[0] as { type: string }).type === 'compute-fft')
      ).toBe(true);
      expect(
        w1Calls.some((c: unknown[]) => (c[0] as { type: string }).type === 'compute-fft')
      ).toBe(false);
    });

    it('fans out to one worker per channel in stereo mode', () => {
      const nativeWorkers: ReturnType<typeof createMockNativeWorker>[] = [];
      const pool = createSpectrogramWorkerPool(() => {
        const w = createMockNativeWorker();
        nativeWorkers.push(w);
        return w;
      }, 2);

      pool.computeFFT({
        clipId: 'clip1',
        channelDataArrays: [new Float32Array(10), new Float32Array(10)],
        config: {},
        sampleRate: 44100,
        offsetSamples: 0,
        durationSamples: 10,
        mono: false,
      });

      // Both workers should receive compute-fft with different channelFilter
      for (let i = 0; i < 2; i++) {
        const calls = (nativeWorkers[i] as unknown as { postMessage: ReturnType<typeof vi.fn> })
          .postMessage.mock.calls;
        const fftCall = calls.find(
          (c: unknown[]) => (c[0] as { type: string }).type === 'compute-fft'
        );
        expect(fftCall).toBeTruthy();
        expect((fftCall![0] as { channelFilter: number }).channelFilter).toBe(i);
      }
    });

    it('caps fan-out to channel count when pool is larger', () => {
      const nativeWorkers: ReturnType<typeof createMockNativeWorker>[] = [];
      const pool = createSpectrogramWorkerPool(() => {
        const w = createMockNativeWorker();
        nativeWorkers.push(w);
        return w;
      }, 3);

      // Only 2 channels but 3 workers
      pool.computeFFT({
        clipId: 'clip1',
        channelDataArrays: [new Float32Array(10), new Float32Array(10)],
        config: {},
        sampleRate: 44100,
        offsetSamples: 0,
        durationSamples: 10,
        mono: false,
      });

      // Worker 0 and 1 should get compute-fft, worker 2 should not
      const w2Calls = (nativeWorkers[2] as unknown as { postMessage: ReturnType<typeof vi.fn> })
        .postMessage.mock.calls;
      expect(
        w2Calls.some((c: unknown[]) => (c[0] as { type: string }).type === 'compute-fft')
      ).toBe(false);
    });

    it('resolves with cacheKey from first worker response', async () => {
      const nativeWorkers: ReturnType<typeof createMockNativeWorker>[] = [];
      const pool = createSpectrogramWorkerPool(() => {
        const w = createMockNativeWorker();
        nativeWorkers.push(w);
        return w;
      }, 2);

      const promise = pool.computeFFT({
        clipId: 'clip1',
        channelDataArrays: [new Float32Array(10), new Float32Array(10)],
        config: {},
        sampleRate: 44100,
        offsetSamples: 0,
        durationSamples: 10,
        mono: false,
      });

      // Respond to both workers
      for (const w of nativeWorkers) {
        const calls = (w as unknown as { postMessage: ReturnType<typeof vi.fn> }).postMessage.mock
          .calls;
        const fftCall = calls.find(
          (c: unknown[]) => (c[0] as { type: string }).type === 'compute-fft'
        );
        if (fftCall) {
          const id = (fftCall[0] as { id: string }).id;
          respondToWorker(w, { id, type: 'cache-key', cacheKey: 'shared-key' });
        }
      }

      const result = await promise;
      expect(result).toEqual({ cacheKey: 'shared-key' });
    });
  });

  describe('renderChunks', () => {
    it('remaps channelIndex to 0 for the target worker', () => {
      const nativeWorkers: ReturnType<typeof createMockNativeWorker>[] = [];
      const pool = createSpectrogramWorkerPool(() => {
        const w = createMockNativeWorker();
        nativeWorkers.push(w);
        return w;
      }, 2);

      pool.renderChunks({
        cacheKey: 'key',
        canvasIds: ['clip1-ch1-chunk0'],
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
        channelIndex: 1,
      });

      // Should go to worker 1 (channelIndex 1), but with channelIndex remapped to 0
      const w1Calls = (nativeWorkers[1] as unknown as { postMessage: ReturnType<typeof vi.fn> })
        .postMessage.mock.calls;
      const renderCall = w1Calls.find(
        (c: unknown[]) => (c[0] as { type: string }).type === 'render-chunks'
      );
      expect(renderCall).toBeTruthy();
      expect((renderCall![0] as { channelIndex: number }).channelIndex).toBe(0);
    });
  });

  describe('abortGeneration', () => {
    it('broadcasts to all workers', () => {
      const nativeWorkers: ReturnType<typeof createMockNativeWorker>[] = [];
      const pool = createSpectrogramWorkerPool(() => {
        const w = createMockNativeWorker();
        nativeWorkers.push(w);
        return w;
      }, 3);

      pool.abortGeneration(7);

      for (const w of nativeWorkers) {
        const calls = (w as unknown as { postMessage: ReturnType<typeof vi.fn> }).postMessage.mock
          .calls;
        const abortCall = calls.find(
          (c: unknown[]) => (c[0] as { type: string }).type === 'abort-generation'
        );
        expect(abortCall).toBeTruthy();
        expect((abortCall![0] as { generation: number }).generation).toBe(7);
      }
    });
  });

  describe('terminate', () => {
    it('terminates all workers', () => {
      const nativeWorkers: ReturnType<typeof createMockNativeWorker>[] = [];
      const pool = createSpectrogramWorkerPool(() => {
        const w = createMockNativeWorker();
        nativeWorkers.push(w);
        return w;
      }, 3);

      pool.terminate();

      for (const w of nativeWorkers) {
        expect(
          (w as unknown as { terminate: ReturnType<typeof vi.fn> }).terminate
        ).toHaveBeenCalled();
      }
    });
  });
});
