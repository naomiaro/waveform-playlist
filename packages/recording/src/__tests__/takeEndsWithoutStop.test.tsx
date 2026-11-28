// #822: a take that ends without the app's stopRecording() (the microphone is
// unplugged, the component is hidden or unmounted) is kept, and the hooks'
// state says what happened to the worklet and the stream.
import { renderHook, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createArrangement } from '@waveform-playlist/engine';
import type { Arrangement } from '@waveform-playlist/engine';
import type { ArrangementTrack, AudioClip } from '@waveform-playlist/core';
import { env, pushSamples, resetRecordingEnv } from './helpers/recordingEnv';
import { renderHookInActivity } from './helpers/activity';

vi.mock(
  '@waveform-playlist/playout',
  async () => (await import('./helpers/recordingEnv')).playoutModule
);
vi.mock(
  '@waveform-playlist/worklets',
  async () => (await import('./helpers/recordingEnv')).workletsModule
);
vi.mock('@waveform-playlist/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@waveform-playlist/core')>();
  return { ...actual, ...(await import('./helpers/recordingEnv')).coreOverrides };
});

const { useIntegratedRecording } = await import('../hooks/useIntegratedRecording');
const { useRecording, useRecordingWithTakeEnded } = await import('../hooks/useRecording');
const { createMockStream, createMockNode, workletsModule } = await import('./helpers/recordingEnv');
const { playoutModule } = await import('./helpers/recordingEnv');

const audioTrack = (id: string): ArrangementTrack =>
  ({ id, name: id, kind: 'audio', clips: [] }) as unknown as ArrangementTrack;
const arrangementOf = (...ids: string[]): Arrangement =>
  createArrangement({ tracks: ids.map(audioTrack) });
const clipsOf = (arrangement: Arrangement, id: string) =>
  arrangement.getTracks().find((t) => t.id === id)!.clips as AudioClip[];

/** The listener the hook put on the microphone track for `ended`. */
function endedListener(stream: MediaStream): () => void {
  const track = stream.getAudioTracks()[0] as unknown as {
    addEventListener: ReturnType<typeof vi.fn>;
  };
  return track.addEventListener.mock.calls.find(([type]) => type === 'ended')![1];
}

/** The browser reports a new device list. Call inside an async `act`. */
function changeDevices(deviceIds: string[]): void {
  const mediaDevices = navigator.mediaDevices as unknown as {
    enumerateDevices: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
  };
  mediaDevices.enumerateDevices.mockImplementation(async () =>
    deviceIds.map((deviceId) => ({ kind: 'audioinput', deviceId, label: deviceId, groupId: 'g' }))
  );
  for (const [type, listener] of mediaDevices.addEventListener.mock.calls) {
    if (type === 'devicechange') listener();
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

beforeEach(() => {
  resetRecordingEnv();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('useIntegratedRecording: a take that ends without stopRecording()', () => {
  async function startTake<R extends { current: ReturnType<typeof useIntegratedRecording> }>(
    result: R
  ) {
    await act(async () => {
      await result.current.requestMicAccess();
    });
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.isRecording).toBe(true);
    act(() => pushSamples(1024));
  }

  it('lands on its track when the microphone is unplugged, and the error says why it ended', async () => {
    const arrangement = arrangementOf('track-1');
    const { result } = renderHook(() => useIntegratedRecording(arrangement, 'track-1'));
    await startTake(result);

    await act(async () => {
      endedListener(result.current.stream!)();
      await settle();
    });

    expect(result.current.isRecording).toBe(false);
    expect(clipsOf(arrangement, 'track-1')).toHaveLength(1);
    expect(clipsOf(arrangement, 'track-1')[0].durationSamples).toBe(1024);
    expect(result.current.error?.message).toBe('Microphone disconnected during recording');
  });

  it('is added once when Stop is pressed while the unplug is being handled', async () => {
    const arrangement = arrangementOf('track-1');
    const { result } = renderHook(() => useIntegratedRecording(arrangement, 'track-1'));
    await startTake(result);

    await act(async () => {
      endedListener(result.current.stream!)();
      await result.current.stopRecording();
      await settle();
    });

    expect(clipsOf(arrangement, 'track-1')).toHaveLength(1);
    // One undo step: a second add of the same take would carve the first away
    // and still leave one clip.
    act(() => arrangement.undo());
    expect(clipsOf(arrangement, 'track-1')).toHaveLength(0);
    expect(arrangement.canUndo).toBe(false);
  });

  it('is added once when stopRecording() is called twice', async () => {
    const arrangement = arrangementOf('track-1');
    const { result } = renderHook(() => useIntegratedRecording(arrangement, 'track-1'));
    await startTake(result);

    await act(async () => {
      await Promise.all([result.current.stopRecording(), result.current.stopRecording()]);
    });

    expect(clipsOf(arrangement, 'track-1')).toHaveLength(1);
    act(() => arrangement.undo());
    expect(clipsOf(arrangement, 'track-1')).toHaveLength(0);
    expect(arrangement.canUndo).toBe(false);
  });

  it('lands on its track when the component is hidden, and the state says the take is over', async () => {
    const arrangement = arrangementOf('track-1');
    const { result, hide, show } = renderHookInActivity(() =>
      useIntegratedRecording(arrangement, 'track-1')
    );
    await startTake(result);

    await act(async () => {
      hide();
    });
    expect(clipsOf(arrangement, 'track-1')).toHaveLength(1);
    expect(clipsOf(arrangement, 'track-1')[0].durationSamples).toBe(1024);

    await act(async () => {
      show();
    });
    expect(result.current.isRecording).toBe(false);
    expect(result.current.recordingTrackId).toBeNull();
    // The cleanup stopped the microphone: the state does not offer a dead stream.
    expect(result.current.stream).toBeNull();
    expect(result.current.hasPermission).toBe(false);
  });

  it('lands on its track when the component unmounts mid-take', async () => {
    const arrangement = arrangementOf('track-1');
    const { result, unmount } = renderHook(() => useIntegratedRecording(arrangement, 'track-1'));
    await startTake(result);

    await act(async () => {
      unmount();
    });

    expect(clipsOf(arrangement, 'track-1')).toHaveLength(1);
  });

  it('does not switch to another microphone mid-take when the selected one leaves the list', async () => {
    const arrangement = arrangementOf('track-1');
    const { result } = renderHook(() => useIntegratedRecording(arrangement, 'track-1'));
    await startTake(result);
    expect(result.current.selectedDevice).toBe('dev-a');
    env.getUserMedia.mockClear();

    await act(async () => {
      changeDevices(['dev-b']);
      await settle();
    });
    // Asking for the other device stops the stream the take is reading.
    expect(env.getUserMedia).not.toHaveBeenCalled();
    expect(result.current.isRecording).toBe(true);

    await act(async () => {
      await result.current.stopRecording();
      await settle();
    });
    expect(env.getUserMedia).toHaveBeenCalledTimes(1);
    expect(env.getUserMedia.mock.calls[0][0].audio.deviceId).toEqual({ exact: 'dev-b' });
    expect(result.current.selectedDevice).toBe('dev-b');
  });

  it('keeps its callbacks when audioConstraints is a new object with each render', async () => {
    const arrangement = arrangementOf('track-1');
    const { result, rerender } = renderHook(
      ({ echo }: { echo: boolean }) =>
        useIntegratedRecording(arrangement, 'track-1', {
          audioConstraints: { echoCancellation: echo },
        }),
      { initialProps: { echo: false } }
    );
    const before = result.current;

    rerender({ echo: true });

    expect(result.current.requestMicAccess).toBe(before.requestMicAccess);
    expect(result.current.changeDevice).toBe(before.changeDevice);
    // The latest constraints are the ones sent.
    await act(async () => {
      await result.current.requestMicAccess();
    });
    expect(env.getUserMedia.mock.calls[0][0].audio.echoCancellation).toBe(true);
  });
});

describe('useRecording: a hidden component', () => {
  it('ends the take with the audio received so far and can record again when shown', async () => {
    const stream = createMockStream('mic');
    const { result, hide, show } = renderHookInActivity(() => useRecording(stream));
    await act(async () => {
      await result.current.startRecording();
    });
    act(() => pushSamples(2048));
    act(() => result.current.pauseRecording());
    expect(result.current.isPaused).toBe(true);
    const firstNode = env.recNode;

    await act(async () => {
      hide();
    });
    await act(async () => {
      show();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.audioBuffer?.length).toBe(2048);
    expect(firstNode.port.onmessage).toBeNull();

    // The hook has let go of that worklet: a second hide does not stop it again.
    await act(async () => {
      hide();
    });
    await act(async () => {
      show();
    });
    const stops = firstNode.port.postMessage.mock.calls.filter(
      ([msg]) => (msg as { command?: string }).command === 'stop'
    );
    expect(stops).toHaveLength(1);
    env.recNode = createMockNode();

    let started: boolean | undefined;
    await act(async () => {
      started = await result.current.startRecording();
    });
    expect(started).toBe(true);
    expect(result.current.isRecording).toBe(true);
  });

  it('leaves a stop that is already in flight to deliver the take', async () => {
    const stream = createMockStream('mic');
    const { result, hide, show } = renderHookInActivity(() => useRecording(stream));
    await act(async () => {
      await result.current.startRecording();
    });
    act(() => pushSamples(512));
    // The worklet never acknowledges: the stop waits on its safety timeout.
    env.recNode.port.postMessage = vi.fn();

    let stopPromise!: Promise<AudioBuffer | null>;
    act(() => {
      stopPromise = result.current.stopRecording();
    });
    await act(async () => {
      hide();
    });
    // That stop still owns the take: until it has finished (and reset the
    // flags it set) no new take starts under it.
    let startedUnderStop: boolean | undefined;
    await act(async () => {
      show();
    });
    await act(async () => {
      startedUnderStop = await result.current.startRecording();
    });
    expect(startedUnderStop).toBe(false);

    let buffer: AudioBuffer | null = null;
    await act(async () => {
      buffer = await stopPromise;
    });
    expect((buffer as AudioBuffer | null)?.length).toBe(512);
  });
});

describe('useIntegratedRecording: a stop while the next take is starting', () => {
  it('leaves that take on its track', async () => {
    const arrangement = arrangementOf('track-1');
    const { result } = renderHook(() => useIntegratedRecording(arrangement, 'track-1'));
    await act(async () => {
      await result.current.requestMicAccess();
    });

    await act(async () => {
      const starting = result.current.startRecording();
      // Nothing is recording yet: this stop has no take to add.
      await result.current.stopRecording();
      await starting;
    });
    expect(result.current.isRecording).toBe(true);
    act(() => pushSamples(1024));
    await act(async () => {
      await result.current.stopRecording();
    });

    expect(clipsOf(arrangement, 'track-1')).toHaveLength(1);
  });
});

describe('useRecording: a start that is waiting when the component is hidden', () => {
  it('does not start after the component is shown again', async () => {
    // The start waits on the worklet module load.
    let loaded!: () => void;
    workletsModule.addRecordingWorkletModule.mockImplementationOnce(
      () => new Promise<void>((resolve) => (loaded = resolve))
    );
    const stream = createMockStream('mic');
    const { result, hide, show } = renderHookInActivity(() => useRecording(stream));
    let starting!: Promise<boolean>;
    act(() => {
      starting = result.current.startRecording();
    });
    await act(async () => {
      await Promise.resolve();
    });

    // The hide stops the microphone the start was given (the owner's cleanup):
    // a take started now would record a stopped stream.
    await act(async () => {
      hide();
    });
    await act(async () => {
      show();
    });
    let started: boolean | undefined;
    await act(async () => {
      loaded();
      started = await starting;
    });

    expect(started).toBe(false);
    expect(result.current.isRecording).toBe(false);
    expect(env.context.createMediaStreamSource).not.toHaveBeenCalled();
  });
});

describe('useIntegratedRecording: asking for the microphone again', () => {
  const requestedDevice = () => env.getUserMedia.mock.lastCall![0].audio.deviceId;

  async function chooseDevB(result: { current: ReturnType<typeof useIntegratedRecording> }) {
    await act(async () => {
      await result.current.requestMicAccess();
    });
    await act(async () => {
      changeDevices(['dev-a', 'dev-b']);
      await settle();
    });
    await act(async () => {
      await result.current.changeDevice('dev-b');
    });
    expect(result.current.selectedDevice).toBe('dev-b');
  }

  it('opens the default device and resets the selection: the picker does not keep an earlier choice', async () => {
    const arrangement = arrangementOf('track-1');
    const { result, hide, show } = renderHookInActivity(() =>
      useIntegratedRecording(arrangement, 'track-1')
    );
    await chooseDevB(result);
    await act(async () => {
      hide();
    });
    await act(async () => {
      show();
    });
    // The stream is gone, and so is the claim that dev-b is the open microphone.
    expect(result.current.stream).toBeNull();

    await act(async () => {
      await result.current.requestMicAccess();
    });

    expect(requestedDevice()).toBeUndefined();
    // Selected again by the hook: the first of the list. The app picks dev-b
    // again with changeDevice().
    expect(result.current.selectedDevice).toBe('dev-a');
  });

  it('resets the selection also when the stream was not lost', async () => {
    const arrangement = arrangementOf('track-1');
    const { result } = renderHook(() => useIntegratedRecording(arrangement, 'track-1'));
    await chooseDevB(result);

    await act(async () => {
      await result.current.requestMicAccess();
    });

    expect(requestedDevice()).toBeUndefined();
    expect(result.current.selectedDevice).toBe('dev-a');
  });

  it('recovers from a changeDevice that failed', async () => {
    const arrangement = arrangementOf('track-1');
    const { result } = renderHook(() => useIntegratedRecording(arrangement, 'track-1'));
    await act(async () => {
      await result.current.requestMicAccess();
    });
    await act(async () => {
      changeDevices(['dev-a', 'dev-b']);
      await settle();
    });
    // dev-b is held by another program: it stays in the list and cannot be opened.
    env.getUserMedia.mockRejectedValueOnce(new Error('NotReadableError'));
    await act(async () => {
      await result.current.changeDevice('dev-b');
    });
    expect(result.current.stream).toBeNull();

    await act(async () => {
      await result.current.requestMicAccess();
    });

    expect(requestedDevice()).toBeUndefined();
    expect(result.current.stream).not.toBeNull();
    expect(result.current.selectedDevice).toBe('dev-a');
  });

  it('asks the same way each time: a deviceId in audioConstraints is kept', async () => {
    const arrangement = arrangementOf('track-1');
    const { result } = renderHook(() =>
      useIntegratedRecording(arrangement, 'track-1', { audioConstraints: { deviceId: 'mine' } })
    );
    await act(async () => {
      await result.current.requestMicAccess();
    });
    await act(async () => {
      await result.current.requestMicAccess();
    });

    expect(env.getUserMedia.mock.calls.map(([c]) => c.audio.deviceId)).toEqual(['mine', 'mine']);
  });

  it('changeDevice asks for that device by exact id', async () => {
    const arrangement = arrangementOf('track-1');
    const { result } = renderHook(() => useIntegratedRecording(arrangement, 'track-1'));
    await chooseDevB(result);

    expect(requestedDevice()).toEqual({ exact: 'dev-b' });
  });

  it('does not start a take when the start was waiting on the audio context across a hide', async () => {
    const arrangement = arrangementOf('track-1');
    const { result, hide, show } = renderHookInActivity(() =>
      useIntegratedRecording(arrangement, 'track-1')
    );
    // The stream is granted, and the resume after it fails: the next start
    // resumes the context itself, and waits there.
    playoutModule.resumeGlobalAudioContext.mockRejectedValueOnce(new Error('not allowed'));
    await act(async () => {
      await result.current.requestMicAccess();
    });
    expect(result.current.stream).not.toBeNull();
    let resumed!: () => void;
    playoutModule.resumeGlobalAudioContext.mockImplementationOnce(
      () => new Promise<void>((resolve) => (resumed = resolve))
    );
    let starting!: Promise<boolean>;
    act(() => {
      starting = result.current.startRecording();
    });

    await act(async () => {
      hide();
    });
    await act(async () => {
      show();
    });
    let started: boolean | undefined;
    await act(async () => {
      resumed();
      started = await starting;
    });

    // The hide stopped the stream that start was given.
    expect(started).toBe(false);
    expect(result.current.isRecording).toBe(false);
    expect(result.current.recordingTrackId).toBeNull();
  });
});

describe('useRecording: a take-ended listener that throws', () => {
  it('does not make the unmount throw', async () => {
    const stream = createMockStream('mic');
    const { result, unmount } = renderHook(() =>
      useRecordingWithTakeEnded(stream, {}, () => {
        throw new Error('listener failed');
      })
    );
    await act(async () => {
      await result.current.startRecording();
    });
    act(() => pushSamples(256));

    expect(() => unmount()).not.toThrow();
    expect(console.warn).toHaveBeenCalledWith(
      '[waveform-playlist] Failed to hand over the interrupted take:',
      'Error: listener failed'
    );
  });
});

describe('useRecording: a stream whose microphone track has ended', () => {
  it('refuses to start, with an error, in place of recording silence', async () => {
    const stream = createMockStream('mic');
    // What the browser reports after an unplug with no other microphone left.
    (stream.getAudioTracks()[0] as unknown as { readyState: string }).readyState = 'ended';
    const { result } = renderHook(() => useRecording(stream));

    let started: boolean | undefined;
    await act(async () => {
      started = await result.current.startRecording();
    });

    expect(started).toBe(false);
    expect(result.current.isRecording).toBe(false);
    expect(result.current.error?.message).toBe(
      'The microphone stream has ended (the device was disconnected or its permission revoked). Request microphone access again.'
    );
    expect(env.context.createMediaStreamSource).not.toHaveBeenCalled();

    // The refusal leaves nothing behind: with a live stream the hook starts.
    (stream.getAudioTracks()[0] as unknown as { readyState: string }).readyState = 'live';
    await act(async () => {
      started = await result.current.startRecording();
    });
    expect(started).toBe(true);
  });
});
