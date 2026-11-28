// What the tests of useIntegratedRecording share: a fake audio context and
// fake worklet nodes behind the mocked playout and worklets packages, the
// core overrides that make a buffer of the pushed samples, a fake microphone,
// and the arrangement helpers.
//
// A test file mocks the three packages with these objects (a `vi.mock`
// factory may import this module):
//
//   vi.mock('@waveform-playlist/playout', async () =>
//     (await import('./helpers/recordingEnv')).playoutModule);
//
// and calls `resetRecordingEnv()` in `beforeEach`.
import { vi } from 'vitest';

export interface MockNode {
  port: {
    postMessage: ReturnType<typeof vi.fn>;
    onmessage: ((event: MessageEvent) => void) | null;
    close: ReturnType<typeof vi.fn>;
  };
  onprocessorerror: ((event: Event) => void) | null;
  disconnect: ReturnType<typeof vi.fn>;
}

export function createMockNode(autoAckStop = true): MockNode {
  const node: MockNode = {
    port: {
      postMessage: vi.fn((msg: { command?: string }) => {
        if (autoAckStop && msg?.command === 'stop' && node.port.onmessage) {
          node.port.onmessage({
            data: { channels: [], channelCount: 1, done: true },
          } as MessageEvent);
        }
      }),
      onmessage: null,
      close: vi.fn(),
    },
    onprocessorerror: null,
    disconnect: vi.fn(),
  };
  return node;
}

export interface MockToneContext {
  state: string;
  sampleRate: number;
  lookAhead: number;
  resume: ReturnType<typeof vi.fn>;
  createMediaStreamSource: ReturnType<typeof vi.fn>;
  createAudioWorkletNode: ReturnType<typeof vi.fn>;
  rawContext: { sampleRate: number; audioWorklet: { addModule: ReturnType<typeof vi.fn> } };
}

/** The current fakes. `resetRecordingEnv()` replaces every one of them. */
export const env = {} as {
  recNode: MockNode;
  meterNode: MockNode;
  context: MockToneContext;
  rawAudioContext: { outputLatency: number; sampleRate: number };
  getUserMedia: ReturnType<typeof vi.fn>;
  /** The device the fake browser opens for a request that names none. */
  defaultDeviceId: string;
};

export const DEFAULT_SAMPLE_RATE = 48000;

/** Fresh fakes; the recording context runs at `sampleRate`, with no latency. */
export function resetRecordingEnv(sampleRate = DEFAULT_SAMPLE_RATE): void {
  env.recNode = createMockNode();
  env.meterNode = createMockNode();
  env.context = {
    state: 'running',
    sampleRate,
    lookAhead: 0,
    resume: vi.fn(() => Promise.resolve()),
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
    createAudioWorkletNode: vi.fn((name: string) =>
      name === 'recording-processor' ? env.recNode : env.meterNode
    ),
    rawContext: {
      sampleRate,
      audioWorklet: { addModule: vi.fn(() => Promise.resolve()) },
    },
  };
  env.rawAudioContext = { outputLatency: 0, sampleRate };
  env.defaultDeviceId = 'dev-a';
  // As the browsers measured on #945: the stream's track reports the device it
  // opened, the requested one or the default.
  env.getUserMedia = vi.fn(async (constraints?: MediaStreamConstraints) =>
    createMockStream('mic', requestedDeviceId(constraints) ?? env.defaultDeviceId)
  );
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: env.getUserMedia,
      enumerateDevices: vi.fn(async () => [
        { kind: 'audioinput', deviceId: 'dev-a', label: 'Mic A', groupId: 'g1' },
      ]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
}

export const playoutModule = {
  getGlobalContext: () => env.context,
  getGlobalAudioContext: () => env.rawAudioContext,
  resumeGlobalAudioContext: vi.fn(() => Promise.resolve()),
};

export const workletsModule = {
  addRecordingWorkletModule: vi.fn(() => Promise.resolve()),
  addMeterWorkletModule: vi.fn(() => Promise.resolve()),
};

/** A stand-in for an AudioBuffer of `length` samples. */
export function fakeBuffer(length: number, sampleRate = DEFAULT_SAMPLE_RATE): AudioBuffer {
  return {
    length,
    sampleRate,
    numberOfChannels: 1,
    duration: length / sampleRate,
    getChannelData: () => new Float32Array(length),
  } as unknown as AudioBuffer;
}

/** The core functions the recording pipeline uses, made to produce a buffer of the pushed samples. */
export const coreOverrides = {
  appendPeaks: vi.fn((existing: Int8Array | Int16Array) => existing),
  concatenateAudioData: vi.fn((chunks: Float32Array[]) => {
    const total = chunks.reduce((sum, c) => sum + c.length, 0);
    return new Float32Array(total);
  }),
  createAudioBuffer: vi.fn((_ctx: unknown, channelData: Float32Array[], sampleRate: number) =>
    fakeBuffer(channelData[0]?.length ?? 0, sampleRate)
  ),
};

function requestedDeviceId(constraints?: MediaStreamConstraints): string | undefined {
  const audio = constraints?.audio;
  if (!audio || typeof audio !== 'object') return undefined;
  const id = audio.deviceId;
  if (typeof id === 'string') return id;
  if (id && !Array.isArray(id) && typeof id === 'object' && typeof id.exact === 'string') {
    return id.exact;
  }
  return undefined;
}

export function createMockStream(id: string, deviceId = 'dev-a'): MediaStream {
  const track = {
    stop: vi.fn(),
    kind: 'audio',
    getSettings: () => ({ channelCount: 1, deviceId }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  return {
    id,
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
}

/** The worklet sends `count` samples of one channel. Call inside `act`. */
export function pushSamples(count: number): void {
  env.recNode.port.onmessage!({
    data: { channels: [new Float32Array(count).fill(0.2)], channelCount: 1 },
  } as MessageEvent);
}

/** True when the recording worklet was told to start. */
export function recordingWorkletStarted(): boolean {
  return env.recNode.port.postMessage.mock.calls.some(
    ([msg]) => (msg as { command?: string })?.command === 'start'
  );
}
