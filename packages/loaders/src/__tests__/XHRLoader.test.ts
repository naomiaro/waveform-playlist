import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { XHRLoader } from '../XHRLoader';
import { LoaderState } from '../Loader';

// Polyfill ProgressEvent for Node.js environment
beforeAll(() => {
  if (typeof globalThis.ProgressEvent === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).ProgressEvent = class ProgressEvent extends Event {
      readonly lengthComputable: boolean;
      readonly loaded: number;
      readonly total: number;

      constructor(
        type: string,
        init?: { lengthComputable?: boolean; loaded?: number; total?: number }
      ) {
        super(type);
        this.lengthComputable = init?.lengthComputable ?? false;
        this.loaded = init?.loaded ?? 0;
        this.total = init?.total ?? 0;
      }
    };
  }
});

// Fake AudioBuffer returned by mock decodeAudioData
const fakeAudioBuffer = {
  length: 44100,
  duration: 1,
  sampleRate: 44100,
  numberOfChannels: 1,
  getChannelData: () => new Float32Array(44100),
  copyFromChannel: vi.fn(),
  copyToChannel: vi.fn(),
} as unknown as AudioBuffer;

// Mock AudioContext with decodeAudioData
function createMockAudioContext(options: { shouldDecode?: boolean } = {}): BaseAudioContext {
  const { shouldDecode = true } = options;
  return {
    decodeAudioData: vi.fn().mockImplementation(() => {
      if (shouldDecode) {
        return Promise.resolve(fakeAudioBuffer);
      }
      return Promise.reject(new Error('Unable to decode audio data'));
    }),
  } as unknown as BaseAudioContext;
}

// ---- Mock XMLHttpRequest ----

type XHREventHandler = (ev: ProgressEvent) => void;

class MockXMLHttpRequest {
  status = 200;
  statusText = 'OK';
  responseType = '';
  response: ArrayBuffer | null = new ArrayBuffer(1024);

  private listeners: Record<string, XHREventHandler[]> = {};

  open = vi.fn();
  send = vi.fn();

  addEventListener(event: string, handler: XHREventHandler) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(handler);
  }

  // Test helpers to fire events
  fireProgress(loaded: number, total: number) {
    this.fireProgressRaw(true, loaded, total);
  }

  fireProgressRaw(lengthComputable: boolean, loaded: number, total: number) {
    const ev = new ProgressEvent('progress', {
      lengthComputable,
      loaded,
      total,
    });
    this.listeners['progress']?.forEach((h) => h(ev));
  }

  fireLoad() {
    const ev = new ProgressEvent('load');
    // Attach target reference so the handler can read status/response
    Object.defineProperty(ev, 'target', { value: this });
    this.listeners['load']?.forEach((h) => h(ev));
  }

  fireError() {
    const ev = new ProgressEvent('error');
    this.listeners['error']?.forEach((h) => h(ev));
  }

  fireAbort() {
    const ev = new ProgressEvent('abort');
    this.listeners['abort']?.forEach((h) => h(ev));
  }
}

let mockXHRInstance: MockXMLHttpRequest;

beforeEach(() => {
  mockXHRInstance = new MockXMLHttpRequest();
  // Use a real class so `new XMLHttpRequest()` works as a constructor
  class StubXHR {
    constructor() {
      return mockXHRInstance;
    }
  }
  vi.stubGlobal('XMLHttpRequest', StubXHR);
});

describe('XHRLoader', () => {
  describe('constructor', () => {
    it('accepts a URL string and starts in UNINITIALIZED state', () => {
      const ac = createMockAudioContext();
      const loader = new XHRLoader('https://example.com/audio.mp3', ac);

      expect(loader.getState()).toBe(LoaderState.UNINITIALIZED);
    });
  });

  describe('load - HTTP success', () => {
    it('resolves with an AudioBuffer on 200 status', async () => {
      const ac = createMockAudioContext();
      const loader = new XHRLoader('https://example.com/audio.mp3', ac);

      mockXHRInstance.send.mockImplementation(() => {
        mockXHRInstance.status = 200;
        mockXHRInstance.statusText = 'OK';
        mockXHRInstance.fireLoad();
      });

      const result = await loader.load();

      expect(result).toBe(fakeAudioBuffer);
      expect(loader.getState()).toBe(LoaderState.FINISHED);
      expect(loader.getAudioBuffer()).toBe(fakeAudioBuffer);
    });

    it('opens the request with GET and the correct URL', async () => {
      const ac = createMockAudioContext();
      const url = 'https://cdn.example.com/track.wav';
      const loader = new XHRLoader(url, ac);

      mockXHRInstance.send.mockImplementation(() => {
        mockXHRInstance.status = 200;
        mockXHRInstance.fireLoad();
      });

      await loader.load();

      expect(mockXHRInstance.open).toHaveBeenCalledWith('GET', url, true);
      expect(mockXHRInstance.responseType).toBe('arraybuffer');
    });

    it('resolves on any 2xx status (e.g. 206)', async () => {
      const ac = createMockAudioContext();
      const loader = new XHRLoader('https://example.com/audio.mp3', ac);

      mockXHRInstance.send.mockImplementation(() => {
        mockXHRInstance.status = 206;
        mockXHRInstance.statusText = 'Partial Content';
        mockXHRInstance.fireLoad();
      });

      const result = await loader.load();

      expect(result).toBe(fakeAudioBuffer);
    });
  });

  describe('load - HTTP errors', () => {
    it('rejects with HTTP error on 404 status', async () => {
      const ac = createMockAudioContext();
      const loader = new XHRLoader('https://example.com/missing.mp3', ac);

      const errorSpy = vi.fn();
      loader.on('error', errorSpy);

      mockXHRInstance.send.mockImplementation(() => {
        mockXHRInstance.status = 404;
        mockXHRInstance.statusText = 'Not Found';
        mockXHRInstance.fireLoad();
      });

      await expect(loader.load()).rejects.toThrow('HTTP 404: Not Found');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'HTTP 404: Not Found' })
      );
    });

    it('rejects with HTTP error on 500 status', async () => {
      const ac = createMockAudioContext();
      const loader = new XHRLoader('https://example.com/audio.mp3', ac);

      const errorSpy = vi.fn();
      loader.on('error', errorSpy);

      mockXHRInstance.send.mockImplementation(() => {
        mockXHRInstance.status = 500;
        mockXHRInstance.statusText = 'Internal Server Error';
        mockXHRInstance.fireLoad();
      });

      await expect(loader.load()).rejects.toThrow('HTTP 500: Internal Server Error');
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('load - network errors', () => {
    it('rejects on network error', async () => {
      const ac = createMockAudioContext();
      const loader = new XHRLoader('https://example.com/audio.mp3', ac);

      const errorSpy = vi.fn();
      loader.on('error', errorSpy);

      mockXHRInstance.send.mockImplementation(() => {
        mockXHRInstance.fireError();
      });

      await expect(loader.load()).rejects.toThrow('Network error while loading audio file');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Network error while loading audio file',
        })
      );
    });

    it('rejects on abort', async () => {
      const ac = createMockAudioContext();
      const loader = new XHRLoader('https://example.com/audio.mp3', ac);

      const errorSpy = vi.fn();
      loader.on('error', errorSpy);

      mockXHRInstance.send.mockImplementation(() => {
        mockXHRInstance.fireAbort();
      });

      await expect(loader.load()).rejects.toThrow('Audio file loading was aborted');
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('progress events', () => {
    it('emits loadprogress with percentage', async () => {
      const ac = createMockAudioContext();
      const loader = new XHRLoader('https://example.com/audio.mp3', ac);

      const progressSpy = vi.fn();
      loader.on('loadprogress', progressSpy);

      mockXHRInstance.send.mockImplementation(() => {
        mockXHRInstance.fireProgress(500, 1000);
        mockXHRInstance.fireProgress(1000, 1000);
        mockXHRInstance.status = 200;
        mockXHRInstance.fireLoad();
      });

      await loader.load();

      expect(progressSpy).toHaveBeenCalledTimes(2);
      expect(progressSpy).toHaveBeenNthCalledWith(1, 50, 'https://example.com/audio.mp3');
      expect(progressSpy).toHaveBeenNthCalledWith(2, 100, 'https://example.com/audio.mp3');
    });

    it('emits 0 percent when length is not computable', async () => {
      const ac = createMockAudioContext();
      const loader = new XHRLoader('https://example.com/audio.mp3', ac);

      const progressSpy = vi.fn();
      loader.on('loadprogress', progressSpy);

      mockXHRInstance.send.mockImplementation(() => {
        mockXHRInstance.fireProgressRaw(false, 500, 0);
        mockXHRInstance.status = 200;
        mockXHRInstance.fireLoad();
      });

      await loader.load();

      expect(progressSpy).toHaveBeenCalledWith(0, 'https://example.com/audio.mp3');
    });
  });

  describe('state transitions', () => {
    it('transitions through LOADING -> DECODING -> FINISHED on success', async () => {
      const ac = createMockAudioContext();
      const loader = new XHRLoader('https://example.com/audio.mp3', ac);

      const stateChanges: LoaderState[] = [];
      loader.on('audiorequeststatechange', (state) => {
        stateChanges.push(state);
      });

      mockXHRInstance.send.mockImplementation(() => {
        // Progress event triggers LOADING state
        mockXHRInstance.fireProgress(500, 1000);
        mockXHRInstance.status = 200;
        mockXHRInstance.fireLoad();
      });

      await loader.load();

      expect(stateChanges).toEqual([
        LoaderState.LOADING,
        LoaderState.DECODING,
        LoaderState.FINISHED,
      ]);
    });

    it('transitions to DECODING -> ERROR when decoding fails', async () => {
      const ac = createMockAudioContext({ shouldDecode: false });
      const loader = new XHRLoader('https://example.com/audio.mp3', ac);

      const stateChanges: LoaderState[] = [];
      loader.on('audiorequeststatechange', (state) => {
        stateChanges.push(state);
      });
      // Suppress the error event so it doesn't cause unhandled rejection noise
      loader.on('error', () => {});

      mockXHRInstance.send.mockImplementation(() => {
        mockXHRInstance.status = 200;
        mockXHRInstance.fireLoad();
      });

      await expect(loader.load()).rejects.toThrow('Unable to decode audio data');

      expect(stateChanges).toEqual([LoaderState.DECODING, LoaderState.ERROR]);
    });

    it('starts in UNINITIALIZED and stays there before load is called', () => {
      const ac = createMockAudioContext();
      const loader = new XHRLoader('https://example.com/audio.mp3', ac);

      expect(loader.getState()).toBe(LoaderState.UNINITIALIZED);
      expect(loader.getAudioBuffer()).toBeUndefined();
    });
  });

  describe('decode failure', () => {
    it('emits error event when decodeAudioData fails', async () => {
      const ac = createMockAudioContext({ shouldDecode: false });
      const loader = new XHRLoader('https://example.com/audio.mp3', ac);

      const errorSpy = vi.fn();
      loader.on('error', errorSpy);

      mockXHRInstance.send.mockImplementation(() => {
        mockXHRInstance.status = 200;
        mockXHRInstance.fireLoad();
      });

      await expect(loader.load()).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Unable to decode audio data' })
      );
      expect(loader.getState()).toBe(LoaderState.ERROR);
    });
  });
});
