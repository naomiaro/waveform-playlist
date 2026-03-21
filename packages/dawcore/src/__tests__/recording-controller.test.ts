import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('@waveform-playlist/playout', () => ({
  getGlobalContext: vi.fn(() => mockToneContext),
}));

vi.mock('@waveform-playlist/worklets', () => ({
  recordingProcessorUrl: 'blob:mock-recording-processor',
}));

vi.mock('@waveform-playlist/recording', () => ({
  appendPeaks: vi.fn((existing) => existing),
  concatenateAudioData: vi.fn(() => new Float32Array(0)),
  createAudioBuffer: vi.fn(() => mockAudioBuffer),
}));

let mockToneContext: any;
let mockRawContext: any;
let mockAudioBuffer: any;
let mockWorkletNode: any;
let mockSource: any;

import { RecordingController } from '../controllers/recording-controller';

function createMockHost() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return Object.assign(el, {
    addController: vi.fn(),
    requestUpdate: vi.fn(),
    updateComplete: Promise.resolve(true),
    samplesPerPixel: 1024,
    effectiveSampleRate: 48000,
    resolveAudioContextSampleRate: vi.fn(),
    _addRecordedClip: vi.fn(),
    _selectedTrackId: 'track-1',
    _currentTime: 0,
  }) as any;
}

function createMockStream(channelCount = 1): MediaStream {
  return {
    getAudioTracks: () => [
      {
        getSettings: () => ({ channelCount }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    ],
  } as any;
}

/** Simulate a worklet message by triggering the onmessage handler */
function simulateWorkletData(_trackId = 'track-1', samples = 1024) {
  const handler = mockWorkletNode.port.onmessage;
  if (handler) {
    handler({ data: { channels: [new Float32Array(samples)] } } as MessageEvent);
  }
}

describe('RecordingController', () => {
  let host: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkletNode = {
      port: { postMessage: vi.fn(), onmessage: null },
      disconnect: vi.fn(),
      addEventListener: vi.fn(),
    };
    mockSource = {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    mockRawContext = {
      audioWorklet: { addModule: vi.fn(() => Promise.resolve()) },
      sampleRate: 48000,
    };
    mockToneContext = {
      rawContext: mockRawContext,
      createMediaStreamSource: vi.fn(() => mockSource),
      createAudioWorkletNode: vi.fn(() => mockWorkletNode),
    };
    mockAudioBuffer = {
      length: 48000,
      sampleRate: 48000,
      numberOfChannels: 1,
    };
    host = createMockHost();
  });

  afterEach(() => {
    host.remove();
    vi.unstubAllGlobals();
  });

  it('startRecording creates a session', async () => {
    const controller = new RecordingController(host);
    const stream = createMockStream();

    await controller.startRecording(stream, { trackId: 'track-1' });

    expect(controller.isRecording).toBe(true);
    expect(controller.getSession('track-1')).toBeTruthy();
    expect(mockSource.connect).toHaveBeenCalledWith(mockWorkletNode);
  });

  it('startRecording warns and returns when no trackId', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const controller = new RecordingController(host);
    host._selectedTrackId = null;

    await controller.startRecording(createMockStream());

    expect(controller.isRecording).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No track selected'));
    warnSpy.mockRestore();
  });

  it('stopRecording dispatches cancelable event and cleans up', async () => {
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1');

    const events: CustomEvent[] = [];
    host.dispatchEvent = vi.fn((e: CustomEvent) => {
      events.push(e);
      return true; // not prevented
    });

    controller.stopRecording();

    expect(mockSource.disconnect).toHaveBeenCalled();
    expect(mockWorkletNode.disconnect).toHaveBeenCalled();
    expect(controller.isRecording).toBe(false);
    expect(controller.getSession('track-1')).toBeUndefined();

    const completeEvent = events.find((e) => e.type === 'daw-recording-complete');
    expect(completeEvent).toBeTruthy();
    expect(completeEvent!.cancelable).toBe(true);
    expect(completeEvent!.detail.trackId).toBe('track-1');
  });

  it('stopRecording with preventDefault skips clip creation', async () => {
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1');

    host.dispatchEvent = vi.fn((e: CustomEvent) => {
      e.preventDefault();
      return false;
    });

    controller.stopRecording();

    // Clip creation would involve calling host methods — verify they weren't called
    expect(controller.getSession('track-1')).toBeUndefined();
  });

  it('stopRecording with no data dispatches error event so button resets', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });

    const events: CustomEvent[] = [];
    const origDispatch = host.dispatchEvent.bind(host);
    host.dispatchEvent = vi.fn((e: Event) => {
      if (e instanceof CustomEvent) events.push(e);
      return origDispatch(e);
    });

    controller.stopRecording();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No audio data'));
    expect(controller.isRecording).toBe(false);
    expect(events.find((e) => e.type === 'daw-recording-complete')).toBeUndefined();
    const errorEvent = events.find((e) => e.type === 'daw-recording-error');
    expect(errorEvent).toBeTruthy();
    expect(errorEvent!.detail.trackId).toBe('track-1');
    warnSpy.mockRestore();
  });

  it('resolves editor sampleRate from AudioContext on start', async () => {
    mockRawContext.sampleRate = 44100;
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });

    expect(host.resolveAudioContextSampleRate).toHaveBeenCalledWith(44100);
  });

  it('computes startSample using resolved effectiveSampleRate', async () => {
    // Simulate: host effectiveSampleRate updated by resolveAudioContextSampleRate
    mockRawContext.sampleRate = 44100;
    host._currentTime = 2.0;
    host.effectiveSampleRate = 44100;
    host.resolveAudioContextSampleRate = vi.fn(() => {
      host.effectiveSampleRate = 44100;
    });

    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });

    const session = controller.getSession('track-1');
    // Should use 44100, not the original default 48000
    expect(session!.startSample).toBe(Math.floor(2.0 * 44100));
  });

  it('rejects recording on a track that already has a session', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });

    await controller.startRecording(createMockStream(), { trackId: 'track-1' });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Already recording'));
    warnSpy.mockRestore();
  });

  it('dispatches daw-recording-start event on start', async () => {
    const events: CustomEvent[] = [];
    const origDispatch = host.dispatchEvent.bind(host);
    host.dispatchEvent = vi.fn((e: Event) => {
      if (e instanceof CustomEvent) events.push(e);
      return origDispatch(e);
    });

    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });

    const startEvent = events.find((e) => e.type === 'daw-recording-start');
    expect(startEvent).toBeTruthy();
    expect(startEvent!.detail.trackId).toBe('track-1');
  });

  it('computes startSample from currentTime and sampleRate', async () => {
    host._currentTime = 2.5;
    host.effectiveSampleRate = 48000;

    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });

    const session = controller.getSession('track-1');
    expect(session!.startSample).toBe(Math.floor(2.5 * 48000));
  });

  it('uses explicit startSample from options', async () => {
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), {
      trackId: 'track-1',
      startSample: 12345,
    });

    const session = controller.getSession('track-1');
    expect(session!.startSample).toBe(12345);
  });

  it('detects channel count from stream', async () => {
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(2), { trackId: 'track-1' });

    const session = controller.getSession('track-1');
    expect(session!.channelCount).toBe(2);
    expect(session!.peaks).toHaveLength(2);
    expect(session!.chunks).toHaveLength(2);
  });

  it('calls host._addRecordedClip when stopRecording is not prevented', async () => {
    host._addRecordedClip = vi.fn();
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1');

    const origDispatch = host.dispatchEvent.bind(host);
    host.dispatchEvent = vi.fn((e: Event) => origDispatch(e));

    controller.stopRecording();

    expect(host._addRecordedClip).toHaveBeenCalledWith(
      'track-1',
      expect.anything(), // audioBuffer
      expect.any(Number), // startSample
      expect.any(Number) // durationSamples
    );
  });

  it('does not call host._addRecordedClip when preventDefault', async () => {
    host._addRecordedClip = vi.fn();
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1');

    host.addEventListener('daw-recording-complete', (e: Event) => {
      e.preventDefault();
    });

    controller.stopRecording();

    expect(host._addRecordedClip).not.toHaveBeenCalled();
  });

  it('cleans up all sessions on hostDisconnected', async () => {
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });

    controller.hostDisconnected();

    expect(controller.isRecording).toBe(false);
    expect(mockSource.disconnect).toHaveBeenCalled();
    // Should send stop command to worklet on cleanup
    expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({ command: 'stop' });
  });

  it('cleans up session on startRecording failure', async () => {
    mockRawContext.audioWorklet.addModule = vi.fn(() => Promise.reject(new Error('CSP blocked')));
    const controller = new RecordingController(host);
    const events: CustomEvent[] = [];
    const origDispatch = host.dispatchEvent.bind(host);
    host.dispatchEvent = vi.fn((e: Event) => {
      if (e instanceof CustomEvent) events.push(e);
      return origDispatch(e);
    });

    await controller.startRecording(createMockStream(), { trackId: 'track-1' });

    expect(controller.isRecording).toBe(false);
    expect(controller.getSession('track-1')).toBeUndefined();
    const errorEvent = events.find((e) => e.type === 'daw-recording-error');
    expect(errorEvent).toBeTruthy();
    expect(errorEvent!.detail.trackId).toBe('track-1');
  });

  // --- _onWorkletMessage tests ---

  it('worklet message accumulates chunks and totalSamples', async () => {
    const { appendPeaks: mockAppendPeaks } = await import('@waveform-playlist/recording');
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });

    simulateWorkletData('track-1', 512);

    const session = controller.getSession('track-1');
    expect(session!.totalSamples).toBe(512);
    expect(session!.chunks[0]).toHaveLength(1);
    expect(mockAppendPeaks).toHaveBeenCalledWith(
      expect.any(Int16Array), // existing peaks
      expect.any(Float32Array), // new samples
      host.samplesPerPixel,
      0, // samplesProcessedBefore
      16 // bits
    );
  });

  it('worklet message calls requestUpdate when pixel width grows', async () => {
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    host.requestUpdate.mockClear();

    // Send enough samples to cross a pixel boundary (samplesPerPixel = 1024)
    simulateWorkletData('track-1', 2048);

    expect(host.requestUpdate).toHaveBeenCalled();
  });

  it('worklet message after session deleted is ignored', async () => {
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    const handler = mockWorkletNode.port.onmessage;

    // Stop recording (deletes session), then trigger the handler — should not throw
    simulateWorkletData('track-1', 512);
    controller.stopRecording();

    // Late message arrives after session is gone
    expect(() => {
      handler({ data: { channels: [new Float32Array(128)] } } as MessageEvent);
    }).not.toThrow();
  });

  it('worklet message with empty channels is ignored', async () => {
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });

    mockWorkletNode.port.onmessage({
      data: { channels: [] },
    } as MessageEvent);

    expect(controller.getSession('track-1')!.totalSamples).toBe(0);
  });
});
