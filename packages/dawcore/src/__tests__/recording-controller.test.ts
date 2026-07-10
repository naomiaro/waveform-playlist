import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('@waveform-playlist/worklets', () => ({
  addRecordingWorkletModule: vi.fn(async (addModule: (url: string) => Promise<void>) => {
    await addModule('blob:mock-recording-processor');
  }),
}));

vi.mock('@waveform-playlist/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@waveform-playlist/core')>();
  return {
    ...actual,
    appendPeaks: vi.fn((existing) => existing),
    concatenateAudioData: vi.fn(() => new Float32Array(0)),
    createAudioBuffer: vi.fn(() => mockAudioBuffer),
  };
});

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
    audioContext: {
      sampleRate: 48000,
      outputLatency: 0,
      state: 'running',
      resume: vi.fn(() => Promise.resolve()),
      createMediaStreamSource: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      audioWorklet: { addModule: vi.fn(() => Promise.resolve()) },
    },
    samplesPerPixel: 1024,
    renderSamplesPerPixel: 1024,
    effectiveSampleRate: 48000,
    resolveAudioContextSampleRate: vi.fn(),
    _addRecordedClip: vi.fn(),
    play: vi.fn(() => Promise.resolve()),
    stop: vi.fn(),
    _selectedTrackId: 'track-1',
    currentTime: 0,
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
      port: {
        // Auto-acknowledge the stop command — the controller awaits the worklet's
        // done message before reading chunks, mirroring the real handshake.
        postMessage: vi.fn((msg: { command?: string }) => {
          if (msg?.command === 'stop' && mockWorkletNode.port.onmessage) {
            mockWorkletNode.port.onmessage({
              data: { channels: [], channelCount: 1, done: true },
            } as MessageEvent);
          }
        }),
        onmessage: null,
      },
      disconnect: vi.fn(),
      addEventListener: vi.fn(),
    };
    mockSource = {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    mockAudioBuffer = {
      length: 48000,
      sampleRate: 48000,
      numberOfChannels: 1,
    };
    // Stub AudioWorkletNode constructor (recording-controller uses `new AudioWorkletNode()`)
    vi.stubGlobal(
      'AudioWorkletNode',
      vi.fn(() => mockWorkletNode)
    );
    host = createMockHost();
    // Override audioContext with mocks that tests can mutate
    host.audioContext = {
      sampleRate: 48000,
      outputLatency: 0,
      state: 'running',
      resume: vi.fn(() => Promise.resolve()),
      createMediaStreamSource: vi.fn(() => mockSource),
      audioWorklet: { addModule: vi.fn(() => Promise.resolve()) },
    };
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

  it('creates AudioWorkletNode with correct context, processor, and channel options', async () => {
    const controller = new RecordingController(host);
    const stream = createMockStream(2);

    await controller.startRecording(stream, { trackId: 'track-1' });

    expect(AudioWorkletNode).toHaveBeenCalledWith(
      host.audioContext,
      'recording-processor',
      expect.objectContaining({
        channelCount: 2,
        channelCountMode: 'explicit',
      })
    );
  });

  it('only calls addModule once across multiple recordings', async () => {
    const controller = new RecordingController(host);

    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    await controller.stopRecording();
    host._selectedTrackId = 'track-2';
    await controller.startRecording(createMockStream(), { trackId: 'track-2' });

    expect(host.audioContext.audioWorklet.addModule).toHaveBeenCalledTimes(1);
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

    await controller.stopRecording();

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

    await controller.stopRecording();

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

    await controller.stopRecording();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No audio data'));
    expect(controller.isRecording).toBe(false);
    expect(events.find((e) => e.type === 'daw-recording-complete')).toBeUndefined();
    const errorEvent = events.find((e) => e.type === 'daw-recording-error');
    expect(errorEvent).toBeTruthy();
    expect(errorEvent!.detail.trackId).toBe('track-1');
    warnSpy.mockRestore();
  });

  it('resolves editor sampleRate from AudioContext on start', async () => {
    host.audioContext.sampleRate = 44100;
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });

    expect(host.resolveAudioContextSampleRate).toHaveBeenCalledWith(44100);
  });

  it('computes startSample using resolved effectiveSampleRate', async () => {
    // Simulate: host effectiveSampleRate updated by resolveAudioContextSampleRate
    host.audioContext.sampleRate = 44100;
    host.currentTime = 2.0;
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
    host.currentTime = 2.5;
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

    await controller.stopRecording();

    expect(host._addRecordedClip).toHaveBeenCalledWith(
      'track-1',
      expect.anything(), // audioBuffer
      expect.any(Number), // startSample
      expect.any(Number), // durationSamples
      expect.any(Number), // offsetSamples (latency compensation)
      undefined // clipName (none provided)
    );
  });

  it('forwards RecordingOptions.clipName to the finalized clip', async () => {
    host._addRecordedClip = vi.fn();
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), {
      trackId: 'track-1',
      clipName: 'Take 1',
    });
    simulateWorkletData('track-1');

    await controller.stopRecording();

    expect(host._addRecordedClip).toHaveBeenCalledWith(
      'track-1',
      expect.anything(),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      'Take 1'
    );
  });

  // --- armed-track transient mute (punch-in replaces the overlapped content,
  // so the recorded-over track's existing material must not play under the take)

  it('mutes the armed track for the session and restores it after stop', async () => {
    host._engine = {
      setTrackMute: vi.fn(),
      getState: vi.fn(() => ({ tracks: [{ id: 'track-1', muted: false }] })),
    };
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    expect(host._engine.setTrackMute).toHaveBeenCalledWith('track-1', true);

    simulateWorkletData('track-1');
    host._engine.setTrackMute.mockClear();
    await controller.stopRecording();
    expect(host._engine.setTrackMute).toHaveBeenCalledWith('track-1', false);
  });

  it('restores a previously-muted armed track to muted, not unmuted', async () => {
    host._engine = {
      setTrackMute: vi.fn(),
      getState: vi.fn(() => ({ tracks: [{ id: 'track-1', muted: true }] })),
    };
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1');
    host._engine.setTrackMute.mockClear();
    await controller.stopRecording();
    expect(host._engine.setTrackMute).toHaveBeenCalledWith('track-1', true);
  });

  it('engages the armed-track mute before overdub playback starts', async () => {
    host._engine = {
      setTrackMute: vi.fn(),
      getState: vi.fn(() => ({ tracks: [{ id: 'track-1', muted: false }] })),
    };
    host.play = vi.fn(() => Promise.resolve());
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1', overdub: true });

    const muteOrder = host._engine.setTrackMute.mock.invocationCallOrder[0];
    const playOrder = (host.play as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    expect(muteOrder).toBeLessThan(playOrder);
  });

  it('restores the armed-track mute when sessions are cleaned up on disconnect', async () => {
    host._engine = {
      setTrackMute: vi.fn(),
      getState: vi.fn(() => ({ tracks: [{ id: 'track-1', muted: false }] })),
    };
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    host._engine.setTrackMute.mockClear();

    controller.hostDisconnected();

    expect(host._engine.setTrackMute).toHaveBeenCalledWith('track-1', false);
  });

  it('restores armed-track mute when no audio data was captured', async () => {
    host._engine = {
      setTrackMute: vi.fn(),
      getState: vi.fn(() => ({ tracks: [{ id: 'track-1', muted: false }] })),
    };
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    host._engine.setTrackMute.mockClear();

    // Stop without ever delivering worklet samples → "No audio data captured" path
    await controller.stopRecording();

    expect(controller.isRecording).toBe(false);
    expect(host._engine.setTrackMute).toHaveBeenCalledWith('track-1', false);
  });

  it('cleans up the session and dispatches daw-recording-error when finalization throws', async () => {
    host._engine = {
      setTrackMute: vi.fn(),
      getState: vi.fn(() => ({ tracks: [{ id: 'track-1', muted: false }] })),
    };
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1');

    const { concatenateAudioData } = await import('@waveform-playlist/core');
    vi.mocked(concatenateAudioData).mockImplementationOnce(() => {
      throw new Error('allocation failed');
    });
    host._engine.setTrackMute.mockClear();
    const events: string[] = [];
    host.dispatchEvent = vi.fn((e: CustomEvent) => {
      events.push(e.type);
      return true;
    });

    // Must resolve (error surfaces via the event, matching the existing
    // no-audio / too-short error-path convention), not reject.
    await expect(controller.stopRecording()).resolves.toBeUndefined();

    expect(controller.isRecording).toBe(false);
    expect(mockSource.disconnect).toHaveBeenCalled();
    expect(host._engine.setTrackMute).toHaveBeenCalledWith('track-1', false);
    expect(events).toContain('daw-recording-error');
  });

  it('a finalization throw does not wedge the next recording on the same track', async () => {
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1');

    const { concatenateAudioData } = await import('@waveform-playlist/core');
    vi.mocked(concatenateAudioData).mockImplementationOnce(() => {
      throw new Error('allocation failed');
    });
    await controller.stopRecording();

    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    expect(controller.isRecording).toBe(true);
    expect(controller.getSession('track-1')).toBeTruthy();
  });

  it('a stop during the async start window cancels the recording', async () => {
    // Hold startRecording inside its worklet-module-load await so the stop
    // lands before the session exists (record→stop double-click on first use).
    const { addRecordingWorkletModule } = await import('@waveform-playlist/worklets');
    let releaseModuleLoad!: () => void;
    vi.mocked(addRecordingWorkletModule).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseModuleLoad = resolve;
        })
    );
    const controller = new RecordingController(host);

    const startPromise = controller.startRecording(createMockStream(), { trackId: 'track-1' });
    await vi.waitFor(() => expect(addRecordingWorkletModule).toHaveBeenCalled());

    // Stop button fires with no explicit trackId — no session exists yet.
    const stopPromise = controller.stopRecording();

    releaseModuleLoad();
    await stopPromise;
    await startPromise;

    expect(controller.isRecording).toBe(false);
    expect(controller.getSession('track-1')).toBeUndefined();
    expect(mockSource.connect).not.toHaveBeenCalled();
  });

  it('isRecording is true during the async start window so the stop button reaches stopRecording', async () => {
    const { addRecordingWorkletModule } = await import('@waveform-playlist/worklets');
    let releaseModuleLoad!: () => void;
    vi.mocked(addRecordingWorkletModule).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseModuleLoad = resolve;
        })
    );
    const controller = new RecordingController(host);

    const startPromise = controller.startRecording(createMockStream(), { trackId: 'track-1' });
    await vi.waitFor(() => expect(addRecordingWorkletModule).toHaveBeenCalled());

    // <daw-stop-button> gates stopRecording() on target.isRecording — if this
    // is false during the start window, the stop-during-start cancel path is
    // unreachable from the very button it exists for.
    expect(controller.isRecording).toBe(true);

    releaseModuleLoad();
    await startPromise;
    expect(controller.isRecording).toBe(true); // session live after start completes
  });

  it('a stop during the start window resolves only after the start has aborted, so an immediate retake succeeds', async () => {
    const { addRecordingWorkletModule } = await import('@waveform-playlist/worklets');
    let releaseModuleLoad!: () => void;
    vi.mocked(addRecordingWorkletModule).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseModuleLoad = resolve;
        })
    );
    const controller = new RecordingController(host);

    const startPromise = controller.startRecording(createMockStream(), { trackId: 'track-1' });
    await vi.waitFor(() => expect(addRecordingWorkletModule).toHaveBeenCalled());

    let stopResolved = false;
    const stopPromise = controller.stopRecording()!.then(() => {
      stopResolved = true;
    });
    await new Promise<void>((r) => setTimeout(r, 10));
    // The in-flight start hasn't aborted yet — a resolved stop here lets
    // `await stop(); start()` hit the still-held _starting guard (lost retake).
    expect(stopResolved).toBe(false);

    releaseModuleLoad();
    await stopPromise;
    await startPromise;

    // Retake immediately after the awaited stop must succeed
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    expect(controller.isRecording).toBe(true);
    expect(controller.getSession('track-1')).toBeTruthy();
  });

  it('a cancelled start dispatches daw-recording-error so awaiting consumers observe an outcome', async () => {
    const { addRecordingWorkletModule } = await import('@waveform-playlist/worklets');
    let releaseModuleLoad!: () => void;
    vi.mocked(addRecordingWorkletModule).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseModuleLoad = resolve;
        })
    );
    const controller = new RecordingController(host);
    const events: string[] = [];
    host.dispatchEvent = vi.fn((e: CustomEvent) => {
      events.push(e.type);
      return true;
    });

    const startPromise = controller.startRecording(createMockStream(), { trackId: 'track-1' });
    await vi.waitFor(() => expect(addRecordingWorkletModule).toHaveBeenCalled());
    const stopPromise = controller.stopRecording();
    releaseModuleLoad();
    await stopPromise;
    await startPromise;

    expect(events).toContain('daw-recording-error');
    expect(events).not.toContain('daw-recording-start');
  });

  it('does not dispatch daw-recording-error when clip insertion throws after daw-recording-complete fired', async () => {
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1');

    host._addRecordedClip = vi.fn(() => {
      throw new Error('carve failed');
    });
    const events: string[] = [];
    host.dispatchEvent = vi.fn((e: CustomEvent) => {
      events.push(e.type);
      return true;
    });

    await controller.stopRecording();

    // The take was already delivered via daw-recording-complete — a trailing
    // daw-recording-error for the same take would contradict it.
    expect(events).toContain('daw-recording-complete');
    expect(events).not.toContain('daw-recording-error');
    expect(controller.isRecording).toBe(false);
  });

  it('hostDisconnected during the async start window prevents a leaked capture session', async () => {
    const { addRecordingWorkletModule } = await import('@waveform-playlist/worklets');
    let releaseModuleLoad!: () => void;
    vi.mocked(addRecordingWorkletModule).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseModuleLoad = resolve;
        })
    );
    const controller = new RecordingController(host);

    const startPromise = controller.startRecording(createMockStream(), { trackId: 'track-1' });
    await vi.waitFor(() => expect(addRecordingWorkletModule).toHaveBeenCalled());

    controller.hostDisconnected();

    releaseModuleLoad();
    await startPromise;

    expect(controller.isRecording).toBe(false);
    expect(mockSource.connect).not.toHaveBeenCalled();
  });

  it('a cancelled start does not poison the next startRecording on the same track', async () => {
    const { addRecordingWorkletModule } = await import('@waveform-playlist/worklets');
    let releaseModuleLoad!: () => void;
    vi.mocked(addRecordingWorkletModule).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseModuleLoad = resolve;
        })
    );
    const controller = new RecordingController(host);

    const startPromise = controller.startRecording(createMockStream(), { trackId: 'track-1' });
    await vi.waitFor(() => expect(addRecordingWorkletModule).toHaveBeenCalled());
    const stopPromise = controller.stopRecording();
    releaseModuleLoad();
    await stopPromise;
    await startPromise;

    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    expect(controller.isRecording).toBe(true);
  });

  it('records without error when the host has no engine', async () => {
    host._engine = null;
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1');
    await controller.stopRecording();
    expect(host._addRecordedClip).toHaveBeenCalled();
  });

  it('does not call host._addRecordedClip when preventDefault', async () => {
    host._addRecordedClip = vi.fn();
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1');

    host.addEventListener('daw-recording-complete', (e: Event) => {
      e.preventDefault();
    });

    await controller.stopRecording();

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
    host.audioContext.audioWorklet.addModule = vi.fn(() =>
      Promise.reject(new Error('CSP blocked'))
    );
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

  it('dispatches actionable error when @waveform-playlist/worklets is missing', async () => {
    // Force worklet re-import by clearing the cached context
    const controller = new RecordingController(host);
    // Mock dynamic import to simulate missing optional peer dep
    vi.doMock('@waveform-playlist/worklets', () => {
      throw new Error('Cannot find module');
    });

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
    expect(String(errorEvent!.detail.error)).toContain('@waveform-playlist/worklets');

    // Restore the original mock for subsequent tests
    vi.doMock('@waveform-playlist/worklets', () => ({
      addRecordingWorkletModule: vi.fn(async (addModule: (url: string) => Promise<void>) => {
        await addModule('blob:mock-recording-processor');
      }),
    }));
  });

  // --- _onWorkletMessage tests ---

  it('worklet message accumulates chunks and totalSamples', async () => {
    const { appendPeaks: mockAppendPeaks } = await import('@waveform-playlist/core');
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
    await controller.stopRecording();

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

  // --- Latency compensation tests ---

  it('passes latency offsetSamples to _addRecordedClip', async () => {
    // Set up latency: outputLatency=0.01s (no Tone.js lookAhead)
    host.audioContext.outputLatency = 0.01;
    host._addRecordedClip = vi.fn();

    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1', 48000); // 1 second of audio

    const origDispatch = host.dispatchEvent.bind(host);
    host.dispatchEvent = vi.fn((e: Event) => origDispatch(e));

    await controller.stopRecording();

    // offsetSamples = floor(0.01 * 48000) = 480
    // durationSamples = 48000 - 480 = 47520
    expect(host._addRecordedClip).toHaveBeenCalledWith(
      'track-1',
      expect.anything(),
      expect.any(Number),
      47520, // effectiveDuration
      480, // latencyOffsetSamples
      undefined // clipName
    );
  });

  it('dispatches error when recording too short for latency compensation', async () => {
    // Latency of 0.5s matches 0.5s recording — no usable samples
    host.audioContext.outputLatency = 0.5;
    // Mock createAudioBuffer to return a buffer matching the short recording
    const { createAudioBuffer } = await import('@waveform-playlist/core');
    vi.mocked(createAudioBuffer).mockReturnValueOnce({
      length: 24000,
      sampleRate: 48000,
      numberOfChannels: 1,
    } as any);

    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1', 24000); // 0.5 seconds at 48kHz

    const events: CustomEvent[] = [];
    const origDispatch = host.dispatchEvent.bind(host);
    host.dispatchEvent = vi.fn((e: Event) => {
      if (e instanceof CustomEvent) events.push(e);
      return origDispatch(e);
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await controller.stopRecording();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('too short'));
    expect(controller.isRecording).toBe(false);
    const errorEvent = events.find((e) => e.type === 'daw-recording-error');
    expect(errorEvent).toBeTruthy();
    warnSpy.mockRestore();
  });

  it('includes offsetSamples in daw-recording-complete event detail', async () => {
    host.audioContext.outputLatency = 0.02;

    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1', 48000);

    const events: CustomEvent[] = [];
    const origDispatch = host.dispatchEvent.bind(host);
    host.dispatchEvent = vi.fn((e: Event) => {
      if (e instanceof CustomEvent) events.push(e);
      return origDispatch(e);
    });

    await controller.stopRecording();

    const completeEvent = events.find((e) => e.type === 'daw-recording-complete');
    expect(completeEvent).toBeTruthy();
    // offsetSamples = floor(0.02 * 48000) = 960
    expect(completeEvent!.detail.offsetSamples).toBe(960);
    expect(completeEvent!.detail.durationSamples).toBe(48000 - 960);
  });

  it('zero latency passes offsetSamples=0', async () => {
    host.audioContext.outputLatency = 0;
    host._addRecordedClip = vi.fn();

    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1', 48000);

    const origDispatch = host.dispatchEvent.bind(host);
    host.dispatchEvent = vi.fn((e: Event) => origDispatch(e));

    await controller.stopRecording();

    expect(host._addRecordedClip).toHaveBeenCalledWith(
      'track-1',
      expect.anything(),
      expect.any(Number),
      48000, // full duration — no offset
      0, // zero latency
      undefined // clipName
    );
  });

  // --- stop handshake tests ---

  it('stopRecording awaits the done ack — late samples reach the AudioBuffer', async () => {
    // Defer the done message to a microtask so it arrives strictly AFTER
    // postMessage returns. If stopRecording forgets to await Promise.race,
    // session.totalSamples stays 0 and the controller bails with
    // "No audio data captured" — no _addRecordedClip call.
    mockWorkletNode.port.postMessage = vi.fn((msg: { command?: string }) => {
      if (msg?.command === 'stop' && mockWorkletNode.port.onmessage) {
        queueMicrotask(() => {
          mockWorkletNode.port.onmessage({
            data: {
              channels: [new Float32Array(1024).fill(0.5)],
              channelCount: 1,
              done: true,
            },
          } as MessageEvent);
        });
      }
    });

    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    // No prior data — only the deferred final message has samples.

    host.dispatchEvent = vi.fn(() => true);
    await controller.stopRecording();

    // _addRecordedClip is only called when the late chunk made it into session.chunks
    expect(host._addRecordedClip).toHaveBeenCalled();
  });

  it('stopRecording proceeds via timeout if the worklet never acks', async () => {
    // Replace auto-ack with a mock that never sends done — exercises the
    // 1000ms safety timeout. Test takes ~1s but verifies the assertion:
    // stop must not hang forever, and pre-stop chunks still produce a clip.
    mockWorkletNode.port.postMessage = vi.fn();

    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1', 512);

    host.dispatchEvent = vi.fn(() => true);
    const start = Date.now();
    await controller.stopRecording();
    const elapsed = Date.now() - start;

    // Should resolve via the 1000ms safety timeout, not hang
    expect(elapsed).toBeLessThan(1500);
    expect(elapsed).toBeGreaterThanOrEqual(900);
    // Pre-stop samples still produce a clip
    expect(host._addRecordedClip).toHaveBeenCalled();
  });

  it('handles channels + done in a single terminal message', async () => {
    // Receiver has separate "hasSamples" and "done" branches; verify a
    // message carrying both still resolves the barrier (stop completes within
    // the timeout window) AND appends samples (concatenateAudioData receives
    // both pre-stop and terminal chunks).
    const { concatenateAudioData } = await import('@waveform-playlist/core');
    vi.mocked(concatenateAudioData).mockClear();

    mockWorkletNode.port.postMessage = vi.fn((msg: { command?: string }) => {
      if (msg?.command === 'stop' && mockWorkletNode.port.onmessage) {
        queueMicrotask(() => {
          mockWorkletNode.port.onmessage({
            data: {
              channels: [new Float32Array(256).fill(0.25)],
              channelCount: 1,
              done: true,
            },
          } as MessageEvent);
        });
      }
    });

    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1', 1024); // pre-stop chunk

    host.dispatchEvent = vi.fn(() => true);
    const start = Date.now();
    await controller.stopRecording();
    expect(Date.now() - start).toBeLessThan(200); // resolved via ack, not timeout

    // concatenateAudioData receives chunkArr per channel — inspect chunk lengths
    expect(concatenateAudioData).toHaveBeenCalled();
    const chunkArr = vi.mocked(concatenateAudioData).mock.calls[0][0];
    const totalLen = chunkArr.reduce((sum: number, c: Float32Array) => sum + c.length, 0);
    expect(totalLen).toBe(1280);
  });

  it('stopRecording from paused state skips the await', async () => {
    // postMessage that does NOT auto-ack proves we don't wait for the
    // terminal flush — pause already drained the partial buffer.
    mockWorkletNode.port.postMessage = vi.fn();

    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1', 1024);

    controller.pauseRecording(); // flips controller._isPaused = true
    expect(controller.isPaused).toBe(true);

    host.dispatchEvent = vi.fn(() => true);
    const start = Date.now();
    await controller.stopRecording();
    const elapsed = Date.now() - start;

    // Should resolve immediately, not wait for the safety timeout
    expect(elapsed).toBeLessThan(50);
    expect(host._addRecordedClip).toHaveBeenCalled();
  });

  it('drain loop captures straggler messages that arrive after stopAck', async () => {
    // After ack-done, fire two more flush messages over a few microtasks.
    // The drain loop must process them before reading session.chunks.
    const { concatenateAudioData } = await import('@waveform-playlist/core');
    vi.mocked(concatenateAudioData).mockClear();

    let stopHandled = false;
    mockWorkletNode.port.postMessage = vi.fn((msg: { command?: string }) => {
      if (msg?.command === 'stop' && !stopHandled && mockWorkletNode.port.onmessage) {
        stopHandled = true;
        // Done arrives synchronously (resolves stopAck)
        mockWorkletNode.port.onmessage({
          data: { channels: [], channelCount: 1, done: true },
        } as MessageEvent);
        // Two stragglers queued for the drain loop to pick up
        setTimeout(() => {
          if (mockWorkletNode.port.onmessage) {
            mockWorkletNode.port.onmessage({
              data: { channels: [new Float32Array(256).fill(0.5)], channelCount: 1 },
            } as MessageEvent);
          }
        }, 6);
        setTimeout(() => {
          if (mockWorkletNode.port.onmessage) {
            mockWorkletNode.port.onmessage({
              data: { channels: [new Float32Array(256).fill(0.7)], channelCount: 1 },
            } as MessageEvent);
          }
        }, 12);
      }
    });

    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1', 1024); // pre-stop chunk

    host.dispatchEvent = vi.fn(() => true);
    await controller.stopRecording();

    // 1024 (pre-stop) + 256 (straggler 1) + 256 (straggler 2) = 1536
    expect(concatenateAudioData).toHaveBeenCalled();
    const chunkArr = vi.mocked(concatenateAudioData).mock.calls[0][0];
    const totalLen = chunkArr.reduce((sum: number, c: Float32Array) => sum + c.length, 0);
    expect(totalLen).toBe(1536);
  });

  it('skips peak gen and DOM updates while stop is in flight', async () => {
    const { appendPeaks } = await import('@waveform-playlist/core');
    vi.mocked(appendPeaks).mockClear();

    // Defer the done so stopRecording is mid-await when our extra message arrives
    mockWorkletNode.port.postMessage = vi.fn((msg: { command?: string }) => {
      if (msg?.command === 'stop' && mockWorkletNode.port.onmessage) {
        // Send an in-flight flush message FIRST (while stopAckResolve is set)
        queueMicrotask(() => {
          mockWorkletNode.port.onmessage!({
            data: { channels: [new Float32Array(256).fill(0.5)], channelCount: 1 },
          } as MessageEvent);
        });
        // Then send done
        queueMicrotask(() => {
          mockWorkletNode.port.onmessage!({
            data: { channels: [], channelCount: 1, done: true },
          } as MessageEvent);
        });
      }
    });

    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1', 1024); // pre-stop — should produce peaks
    const preStopAppendCount = vi.mocked(appendPeaks).mock.calls.length;
    expect(preStopAppendCount).toBeGreaterThan(0);

    host.dispatchEvent = vi.fn(() => true);
    await controller.stopRecording();

    // The in-flight flush during stop must NOT have called appendPeaks again,
    // even though its samples ARE in the AudioBuffer (drain loop captures
    // chunks). The pre-stop count should equal the post-stop count.
    expect(vi.mocked(appendPeaks).mock.calls.length).toBe(preStopAppendCount);
    expect(host._addRecordedClip).toHaveBeenCalled();
  });

  it('stopping flag blocks pauseRecording / resumeRecording', async () => {
    // Defer the done so stopRecording stays mid-flight when we attempt
    // pause/resume. Verifies session.stopping prevents state corruption
    // (would otherwise dispatch events for a session about to be deleted).
    mockWorkletNode.port.postMessage = vi.fn((msg: { command?: string }) => {
      if (msg?.command === 'stop' && mockWorkletNode.port.onmessage) {
        setTimeout(() => {
          mockWorkletNode.port.onmessage!({
            data: { channels: [], channelCount: 1, done: true },
          } as MessageEvent);
        }, 20);
      }
    });

    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1', 512);

    const events: string[] = [];
    host.dispatchEvent = vi.fn((e: Event) => {
      events.push(e.type);
      return true;
    });

    // Begin stop; while it's in flight, attempt pause + resume
    const stopPromise = controller.stopRecording();
    controller.pauseRecording('track-1');
    controller.resumeRecording('track-1');

    await stopPromise;

    // Neither daw-recording-pause nor daw-recording-resume should fire
    // for the stopping session.
    expect(events).not.toContain('daw-recording-pause');
    expect(events).not.toContain('daw-recording-resume');
  });

  // --- entry-guard tests ---

  it('concurrent startRecording calls create only one session (double-start guard)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Defer worklet module load so both calls overlap in the await window
    let resolveAdd!: () => void;
    host.audioContext.audioWorklet.addModule = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolveAdd = r;
        })
    );

    // Count without forwarding to the real dispatchEvent — happy-dom's
    // propagation re-invokes the patched instance method (3x per dispatch).
    const events: string[] = [];
    host.dispatchEvent = vi.fn((e: Event) => {
      events.push(e.type);
      return true;
    });

    const controller = new RecordingController(host);
    const p1 = controller.startRecording(createMockStream(), { trackId: 'track-1' });
    const p2 = controller.startRecording(createMockStream(), { trackId: 'track-1' });
    // The dynamic import() precedes addModule — wait for the deferred point
    await vi.waitFor(() => {
      expect(host.audioContext.audioWorklet.addModule).toHaveBeenCalled();
    });
    resolveAdd();
    await Promise.all([p1, p2]);

    // Exactly one capture pipeline: one source, one worklet node, one event
    expect(host.audioContext.createMediaStreamSource).toHaveBeenCalledTimes(1);
    expect(vi.mocked(AudioWorkletNode).mock.calls).toHaveLength(1);
    expect(events.filter((t) => t === 'daw-recording-start')).toHaveLength(1);
    expect(controller.isRecording).toBe(true);
    warnSpy.mockRestore();
  });

  it('concurrent stopRecording calls produce a single clip (re-entrancy guard)', async () => {
    // Defer the done ack so the second stop lands mid-handshake
    let stops = 0;
    mockWorkletNode.port.postMessage = vi.fn((msg: { command?: string }) => {
      if (msg?.command === 'stop') {
        stops++;
        if (stops === 1) {
          setTimeout(() => {
            mockWorkletNode.port.onmessage!({
              data: { channels: [], channelCount: 1, done: true },
            } as MessageEvent);
          }, 20);
        }
      }
    });

    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1', 1024);

    const events: string[] = [];
    host.dispatchEvent = vi.fn((e: Event) => {
      events.push(e.type);
      return true;
    });

    const s1 = controller.stopRecording();
    const s2 = controller.stopRecording();
    await Promise.all([s1, s2]);

    expect(host._addRecordedClip).toHaveBeenCalledTimes(1);
    expect(events.filter((t) => t === 'daw-recording-complete')).toHaveLength(1);
    expect(controller.isRecording).toBe(false);
  });

  it('paused stop still drains in-transit flush messages', async () => {
    const { concatenateAudioData } = await import('@waveform-playlist/core');
    vi.mocked(concatenateAudioData).mockClear();

    // Simulate the pause-time flush still being in transit when stop is
    // called: it arrives a few ms after the stop command is posted.
    mockWorkletNode.port.postMessage = vi.fn((msg: { command?: string }) => {
      if (msg?.command === 'stop') {
        setTimeout(() => {
          if (mockWorkletNode.port.onmessage) {
            mockWorkletNode.port.onmessage({
              data: { channels: [new Float32Array(256).fill(0.4)], channelCount: 1 },
            } as MessageEvent);
          }
        }, 6);
      }
    });

    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1', 1024);
    controller.pauseRecording();

    host.dispatchEvent = vi.fn(() => true);
    await controller.stopRecording();

    // 1024 pre-pause + 256 in-transit pause flush
    const chunkArr = vi.mocked(concatenateAudioData).mock.calls[0][0];
    const totalLen = chunkArr.reduce((sum: number, c: Float32Array) => sum + c.length, 0);
    expect(totalLen).toBe(1280);
  });

  it('pause state does not leak into the next session after disposal', async () => {
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    controller.pauseRecording();
    expect(controller.isPaused).toBe(true);

    controller.hostDisconnected();

    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    expect(controller.isPaused).toBe(false);
  });

  it('computes startSample from the live currentTime getter (punch-in during playback)', async () => {
    // Live playhead is at 10s; the cached private field lags at 0 (it is only
    // written on pause/stop/seek). Punch-in must use the live value.
    host.currentTime = 10.0;
    host._currentTime = 0;

    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });

    const session = controller.getSession('track-1');
    expect(session!.startSample).toBe(Math.floor(10.0 * 48000));
  });

  it('resumes a suspended AudioContext before recording starts', async () => {
    host.audioContext.state = 'suspended';
    const resumeSpy = host.audioContext.resume;

    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1', 512);

    expect(resumeSpy).toHaveBeenCalled();
    expect(controller.isRecording).toBe(true);
  });

  it('labels the recorded AudioBuffer with the capture-time context rate (#576)', async () => {
    const { createAudioBuffer } = await import('@waveform-playlist/core');
    vi.mocked(createAudioBuffer).mockClear();
    // Capture context runs at 44100; the editor-space sticky rate lags at 48000
    // (resolveAudioContextSampleRate only sets it when unset).
    host.audioContext.sampleRate = 44100;
    host.effectiveSampleRate = 48000;

    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1', 44100);

    host.dispatchEvent = vi.fn(() => true);
    await controller.stopRecording();

    // Labeling with the stale editor rate plays the take ~8.9% off-speed.
    expect(vi.mocked(createAudioBuffer).mock.calls[0][2]).toBe(44100);
  });

  it('appends live-preview peaks at renderSamplesPerPixel (beats-mode alignment, #577)', async () => {
    const { appendPeaks } = await import('@waveform-playlist/core');
    vi.mocked(appendPeaks).mockClear();
    // In beats mode the render scale is derived from ticksPerPixel/bpm and
    // differs from the raw samplesPerPixel property.
    host.samplesPerPixel = 1024;
    host.renderSamplesPerPixel = 512;

    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1', 512);

    expect(vi.mocked(appendPeaks).mock.calls[0][2]).toBe(512);
  });

  it('dispatches daw-recording-error when the editor is disposed mid-recording (#578)', async () => {
    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), { trackId: 'track-1' });
    simulateWorkletData('track-1', 512);

    const events: CustomEvent[] = [];
    host.dispatchEvent = vi.fn((e: Event) => {
      if (e instanceof CustomEvent) events.push(e);
      return true;
    });

    controller.hostDisconnected();

    // Without this, a record button in a still-connected <daw-transport>
    // stays wedged red forever — its listeners are on the dead editor.
    const errorEvent = events.find((e) => e.type === 'daw-recording-error');
    expect(errorEvent).toBeTruthy();
    expect(errorEvent!.detail.trackId).toBe('track-1');
  });

  it('latencyOffset option overrides the auto-computed offset', async () => {
    // outputLatency=0 → the auto-computed offset would be 0; the override must win.
    host.audioContext.outputLatency = 0;
    host._addRecordedClip = vi.fn();

    const controller = new RecordingController(host);
    await controller.startRecording(createMockStream(), {
      trackId: 'track-1',
      latencyOffset: 0.01, // 10ms
    });
    simulateWorkletData('track-1', 48000); // 1 second of audio

    await controller.stopRecording();

    // offsetSamples = floor(0.01 * 48000) = 480; durationSamples = 48000 - 480 = 47520
    expect(host._addRecordedClip).toHaveBeenCalledWith(
      'track-1',
      expect.anything(),
      expect.any(Number),
      47520, // effectiveDuration
      480, // latencyOffsetSamples (from the override, not outputLatency)
      undefined // clipName
    );
  });
});
