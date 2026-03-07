import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { BlobLoader } from '../BlobLoader';
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

// ---- Mock FileReader ----

type FREventHandler = (ev: ProgressEvent) => void;

class MockFileReader {
  result: ArrayBuffer | null = new ArrayBuffer(1024);

  private listeners: Record<string, FREventHandler[]> = {};

  addEventListener(event: string, handler: FREventHandler) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(handler);
  }

  readAsArrayBuffer = vi.fn().mockImplementation(() => {
    // Default: immediately fire load
    this.fireLoad();
  });

  // Test helpers
  fireProgress(loaded: number, total: number) {
    const ev = new ProgressEvent('progress', {
      lengthComputable: true,
      loaded,
      total,
    });
    this.listeners['progress']?.forEach((h) => h(ev));
  }

  fireLoad() {
    const ev = new ProgressEvent('load');
    this.listeners['load']?.forEach((h) => h(ev));
  }

  fireError() {
    const ev = new ProgressEvent('error');
    this.listeners['error']?.forEach((h) => h(ev));
  }
}

let mockFileReaderInstance: MockFileReader;

beforeEach(() => {
  mockFileReaderInstance = new MockFileReader();
  class StubFileReader {
    constructor() {
      return mockFileReaderInstance;
    }
  }
  vi.stubGlobal('FileReader', StubFileReader);
});

describe('BlobLoader', () => {
  describe('constructor', () => {
    it('accepts a Blob and starts in UNINITIALIZED state', () => {
      const blob = new Blob(['fake audio'], { type: 'audio/wav' });
      const ac = createMockAudioContext();
      const loader = new BlobLoader(blob, ac);

      expect(loader.getState()).toBe(LoaderState.UNINITIALIZED);
      expect(loader.getAudioBuffer()).toBeUndefined();
    });
  });

  describe('audio mime type validation', () => {
    it('accepts audio/wav', async () => {
      const blob = new Blob(['fake audio'], { type: 'audio/wav' });
      const ac = createMockAudioContext();
      const loader = new BlobLoader(blob, ac);

      const result = await loader.load();

      expect(result).toBe(fakeAudioBuffer);
    });

    it('accepts audio/mp3', async () => {
      const blob = new Blob(['fake audio'], { type: 'audio/mp3' });
      const ac = createMockAudioContext();
      const loader = new BlobLoader(blob, ac);

      const result = await loader.load();

      expect(result).toBe(fakeAudioBuffer);
    });

    it('accepts audio/ogg', async () => {
      const blob = new Blob(['fake audio'], { type: 'audio/ogg' });
      const ac = createMockAudioContext();
      const loader = new BlobLoader(blob, ac);

      const result = await loader.load();

      expect(result).toBe(fakeAudioBuffer);
    });

    it('accepts audio/mpeg', async () => {
      const blob = new Blob(['fake audio'], { type: 'audio/mpeg' });
      const ac = createMockAudioContext();
      const loader = new BlobLoader(blob, ac);

      const result = await loader.load();

      expect(result).toBe(fakeAudioBuffer);
    });

    it('accepts video/ogg (Firefox compatibility)', async () => {
      const blob = new Blob(['fake audio'], { type: 'video/ogg' });
      const ac = createMockAudioContext();
      const loader = new BlobLoader(blob, ac);

      const result = await loader.load();

      expect(result).toBe(fakeAudioBuffer);
    });

    it('rejects non-audio mime types (text/plain)', async () => {
      const blob = new Blob(['not audio'], { type: 'text/plain' });
      const ac = createMockAudioContext();
      const loader = new BlobLoader(blob, ac);

      const errorSpy = vi.fn();
      loader.on('error', errorSpy);

      await expect(loader.load()).rejects.toThrow('Unsupported file type: text/plain');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Unsupported file type: text/plain',
        })
      );
    });

    it('rejects application/json', async () => {
      const blob = new Blob(['{}'], { type: 'application/json' });
      const ac = createMockAudioContext();
      const loader = new BlobLoader(blob, ac);

      const errorSpy = vi.fn();
      loader.on('error', errorSpy);

      await expect(loader.load()).rejects.toThrow('Unsupported file type: application/json');
    });

    it('rejects video/mp4 (only video/ogg is allowed)', async () => {
      const blob = new Blob(['video data'], { type: 'video/mp4' });
      const ac = createMockAudioContext();
      const loader = new BlobLoader(blob, ac);

      const errorSpy = vi.fn();
      loader.on('error', errorSpy);

      await expect(loader.load()).rejects.toThrow('Unsupported file type: video/mp4');
    });

    it('rejects empty mime type', async () => {
      const blob = new Blob(['data'], { type: '' });
      const ac = createMockAudioContext();
      const loader = new BlobLoader(blob, ac);

      const errorSpy = vi.fn();
      loader.on('error', errorSpy);

      await expect(loader.load()).rejects.toThrow('Unsupported file type: ');
    });
  });

  describe('FileReader progress events', () => {
    it('emits loadprogress with percentage', async () => {
      const blob = new Blob(['fake audio'], { type: 'audio/wav' });
      const ac = createMockAudioContext();
      const loader = new BlobLoader(blob, ac);

      const progressSpy = vi.fn();
      loader.on('loadprogress', progressSpy);

      mockFileReaderInstance.readAsArrayBuffer.mockImplementation(() => {
        mockFileReaderInstance.fireProgress(256, 1024);
        mockFileReaderInstance.fireProgress(1024, 1024);
        mockFileReaderInstance.fireLoad();
      });

      await loader.load();

      expect(progressSpy).toHaveBeenCalledTimes(2);
      expect(progressSpy).toHaveBeenNthCalledWith(1, 25, blob);
      expect(progressSpy).toHaveBeenNthCalledWith(2, 100, blob);
    });
  });

  describe('FileReader errors', () => {
    it('rejects and emits error when FileReader fails', async () => {
      const blob = new Blob(['fake audio'], { type: 'audio/wav' });
      const ac = createMockAudioContext();
      const loader = new BlobLoader(blob, ac);

      const errorSpy = vi.fn();
      loader.on('error', errorSpy);

      mockFileReaderInstance.readAsArrayBuffer.mockImplementation(() => {
        mockFileReaderInstance.fireError();
      });

      await expect(loader.load()).rejects.toThrow('Failed to read audio file');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Failed to read audio file' })
      );
    });
  });

  describe('state transitions', () => {
    it('transitions through LOADING -> DECODING -> FINISHED on success', async () => {
      const blob = new Blob(['fake audio'], { type: 'audio/wav' });
      const ac = createMockAudioContext();
      const loader = new BlobLoader(blob, ac);

      const stateChanges: LoaderState[] = [];
      loader.on('audiorequeststatechange', (state) => {
        stateChanges.push(state);
      });

      mockFileReaderInstance.readAsArrayBuffer.mockImplementation(() => {
        // Progress triggers LOADING state transition
        mockFileReaderInstance.fireProgress(512, 1024);
        mockFileReaderInstance.fireLoad();
      });

      await loader.load();

      expect(stateChanges).toEqual([
        LoaderState.LOADING,
        LoaderState.DECODING,
        LoaderState.FINISHED,
      ]);
    });

    it('transitions to DECODING -> ERROR when decoding fails', async () => {
      const blob = new Blob(['fake audio'], { type: 'audio/wav' });
      const ac = createMockAudioContext({ shouldDecode: false });
      const loader = new BlobLoader(blob, ac);

      const stateChanges: LoaderState[] = [];
      loader.on('audiorequeststatechange', (state) => {
        stateChanges.push(state);
      });
      loader.on('error', () => {});

      await expect(loader.load()).rejects.toThrow('Unable to decode audio data');

      expect(stateChanges).toEqual([LoaderState.DECODING, LoaderState.ERROR]);
    });

    it('does not transition states on unsupported mime type', async () => {
      const blob = new Blob(['not audio'], { type: 'image/png' });
      const ac = createMockAudioContext();
      const loader = new BlobLoader(blob, ac);

      const stateChanges: LoaderState[] = [];
      loader.on('audiorequeststatechange', (state) => {
        stateChanges.push(state);
      });
      loader.on('error', () => {});

      await expect(loader.load()).rejects.toThrow('Unsupported file type');

      // No state transitions occur — rejected immediately
      expect(stateChanges).toEqual([]);
      expect(loader.getState()).toBe(LoaderState.UNINITIALIZED);
    });
  });

  describe('decode failure', () => {
    it('emits error event and sets ERROR state when decodeAudioData fails', async () => {
      const blob = new Blob(['fake audio'], { type: 'audio/wav' });
      const ac = createMockAudioContext({ shouldDecode: false });
      const loader = new BlobLoader(blob, ac);

      const errorSpy = vi.fn();
      loader.on('error', errorSpy);

      await expect(loader.load()).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Unable to decode audio data' })
      );
      expect(loader.getState()).toBe(LoaderState.ERROR);
    });
  });

  describe('File input (File extends Blob)', () => {
    it('works with File objects that have audio mime type', async () => {
      const file = new File(['fake audio'], 'track.mp3', {
        type: 'audio/mp3',
      });
      const ac = createMockAudioContext();
      const loader = new BlobLoader(file, ac);

      const result = await loader.load();

      expect(result).toBe(fakeAudioBuffer);
      expect(mockFileReaderInstance.readAsArrayBuffer).toHaveBeenCalledWith(file);
    });
  });
});
