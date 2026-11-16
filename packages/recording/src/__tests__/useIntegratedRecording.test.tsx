import { renderHook, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createArrangement } from '@waveform-playlist/engine';
import type { Arrangement } from '@waveform-playlist/engine';
import type { ArrangementTrack, AudioClip } from '@waveform-playlist/core';
import { env, pushSamples, resetRecordingEnv } from './helpers/recordingEnv';

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

function makeTrack(id: string, clips: ArrangementTrack['clips'] = []): ArrangementTrack {
  return { id, name: id, clips } as ArrangementTrack;
}

const arrangementOf = (tracks: ArrangementTrack[]): Arrangement => createArrangement({ tracks });
const clipsOf = (arrangement: Arrangement, id: string) =>
  arrangement.getTracks().find((t) => t.id === id)!.clips;

beforeEach(() => {
  resetRecordingEnv();
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.clearAllMocks();
});

describe('useIntegratedRecording', () => {
  async function setupRecording(arrangement: Arrangement) {
    const rendered = renderHook(() => useIntegratedRecording(arrangement, 'track-1'));

    await act(async () => {
      await rendered.result.current.requestMicAccess();
    });
    await act(async () => {
      await rendered.result.current.startRecording();
    });
    expect(rendered.result.current.isRecording).toBe(true);
    return rendered;
  }

  it('exposes the meter and the recording progress as sources, not as state', async () => {
    const { result } = await setupRecording(arrangementOf([makeTrack('track-1')]));

    expect(typeof result.current.meter.subscribe).toBe('function');
    expect(result.current.meter.getSnapshot().levels.length).toBeGreaterThan(0);
    expect(typeof result.current.progress.subscribe).toBe('function');
    expect(result.current.progress.getSnapshot().peaks.length).toBeGreaterThan(0);
    for (const removed of [
      'duration',
      'level',
      'peakLevel',
      'levels',
      'peakLevels',
      'rmsLevels',
      'recordingPeaks',
    ]) {
      expect(result.current).not.toHaveProperty(removed);
    }
  });

  it('refuses to record onto a MIDI track (#756)', async () => {
    const midiTrack: ArrangementTrack = { ...makeTrack('track-1'), kind: 'midi', name: 'Keys' };
    const arrangement = arrangementOf([midiTrack]);
    const tracksBefore = arrangement.getTracks();
    const { result } = renderHook(() => useIntegratedRecording(arrangement, 'track-1'));
    await act(async () => {
      await result.current.requestMicAccess();
    });

    let started: boolean | undefined;
    await act(async () => {
      started = await result.current.startRecording();
    });

    expect(started).toBe(false);
    expect(result.current.recordingTrackId).toBeNull();
    expect(result.current.isRecording).toBe(false);
    expect(result.current.error?.message).toBe(
      'Cannot start recording: "Keys" is a MIDI track. Select or create an audio track first.'
    );
    expect(arrangement.getTracks()).toBe(tracksBefore);
  });

  it.each(['midi', 'audio'] as const)(
    'the take lands on the track it was started on when a %s track is selected mid-take (#756)',
    async (otherKind) => {
      const arrangement = arrangementOf([
        { ...makeTrack('track-1'), kind: 'audio' },
        { ...makeTrack('track-2'), kind: otherKind },
      ]);
      const { result, rerender } = renderHook(
        ({ selected }: { selected: string }) => useIntegratedRecording(arrangement, selected),
        { initialProps: { selected: 'track-1' } }
      );
      await act(async () => {
        await result.current.requestMicAccess();
      });
      await act(async () => {
        await result.current.startRecording();
      });
      expect(result.current.isRecording).toBe(true);
      expect(result.current.recordingTrackId).toBe('track-1');

      rerender({ selected: 'track-2' });
      expect(result.current.recordingTrackId).toBe('track-1');
      act(() => pushSamples(1024));
      await act(async () => {
        await result.current.stopRecording();
      });

      expect(result.current.recordingTrackId).toBeNull();
      expect(clipsOf(arrangement, 'track-1')).toHaveLength(1);
      expect(clipsOf(arrangement, 'track-2')).toHaveLength(0);
    }
  );

  it('a second startRecording() during a take changes nothing: the take stays on its track (#756)', async () => {
    const arrangement = arrangementOf([
      { ...makeTrack('track-1'), kind: 'audio' },
      { ...makeTrack('track-2'), kind: 'audio' },
    ]);
    const { result, rerender } = renderHook(
      ({ selected }: { selected: string }) => useIntegratedRecording(arrangement, selected),
      { initialProps: { selected: 'track-1' } }
    );
    await act(async () => {
      await result.current.requestMicAccess();
    });
    await act(async () => {
      await result.current.startRecording();
    });
    rerender({ selected: 'track-2' });

    let second: boolean | undefined;
    await act(async () => {
      second = await result.current.startRecording();
    });

    expect(second).toBe(false);
    expect(result.current.isRecording).toBe(true);
    expect(result.current.recordingTrackId).toBe('track-1');

    act(() => pushSamples(1024));
    await act(async () => {
      await result.current.stopRecording();
    });
    expect(clipsOf(arrangement, 'track-1')).toHaveLength(1);
    expect(clipsOf(arrangement, 'track-2')).toHaveLength(0);
  });

  it('a second startRecording() while the first is still starting changes nothing (#756)', async () => {
    const arrangement = arrangementOf([
      { ...makeTrack('track-1'), kind: 'audio' },
      { ...makeTrack('track-2'), kind: 'audio' },
    ]);
    const { result, rerender } = renderHook(
      ({ selected }: { selected: string }) => useIntegratedRecording(arrangement, selected),
      { initialProps: { selected: 'track-1' } }
    );
    await act(async () => {
      await result.current.requestMicAccess();
    });

    let first: boolean | undefined;
    let second: boolean | undefined;
    await act(async () => {
      // Not awaited: the first start is parked in its async startup.
      const firstStart = result.current.startRecording();
      rerender({ selected: 'track-2' });
      second = await result.current.startRecording();
      first = await firstStart;
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(result.current.isRecording).toBe(true);
    expect(result.current.recordingTrackId).toBe('track-1');

    act(() => pushSamples(1024));
    await act(async () => {
      await result.current.stopRecording();
    });
    expect(clipsOf(arrangement, 'track-1')).toHaveLength(1);
    expect(clipsOf(arrangement, 'track-2')).toHaveLength(0);

    // The take is over: a new one can start, on the track selected now.
    let third: boolean | undefined;
    await act(async () => {
      third = await result.current.startRecording();
    });
    expect(third).toBe(true);
    expect(result.current.recordingTrackId).toBe('track-2');
  });

  it('recordingTrackId is null again when a take ends on its own (microphone unplugged)', async () => {
    const arrangement = arrangementOf([{ ...makeTrack('track-1'), kind: 'audio' }]);
    const { result } = renderHook(() => useIntegratedRecording(arrangement, 'track-1'));
    await act(async () => {
      await result.current.requestMicAccess();
    });
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.recordingTrackId).toBe('track-1');

    // The browser ends the microphone track: useRecording stops by itself.
    const stream = result.current.stream!;
    const audioTrack = stream.getAudioTracks()[0] as unknown as {
      addEventListener: ReturnType<typeof vi.fn>;
    };
    const onEnded = audioTrack.addEventListener.mock.calls.find(([type]) => type === 'ended')![1];
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await act(async () => {
      onEnded();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.recordingTrackId).toBeNull();
  });

  it('rejects changeDevice while recording (stream untouched, error surfaced)', async () => {
    const { result } = await setupRecording(arrangementOf([makeTrack('track-1')]));

    const streamBefore = result.current.stream;
    env.getUserMedia.mockClear();

    await act(async () => {
      await result.current.changeDevice('dev-b');
    });

    // Switching devices mid-recording stops the old stream's tracks without
    // firing 'ended' — the rest of the take silently records silence. The
    // guard must refuse instead.
    expect(env.getUserMedia).not.toHaveBeenCalled();
    expect(result.current.stream).toBe(streamBefore);
    expect(result.current.isRecording).toBe(true);
    expect(result.current.error?.message).toMatch(/recording/i);
  });

  it('rejects requestMicAccess while recording', async () => {
    const { result } = await setupRecording(arrangementOf([makeTrack('track-1')]));

    env.getUserMedia.mockClear();
    await act(async () => {
      await result.current.requestMicAccess();
    });

    expect(env.getUserMedia).not.toHaveBeenCalled();
    expect(result.current.isRecording).toBe(true);
  });

  it('punch-in: recorded clip lands at the playhead and replaces overlapped content (#579)', async () => {
    const existingClip: AudioClip = {
      id: 'existing',
      startSample: 0,
      durationSamples: 2048,
      offsetSamples: 0,
      sampleRate: 48000,
      sourceDurationSamples: 2048,
      gain: 1,
    };
    const arrangement = arrangementOf([makeTrack('track-1', [existingClip])]);
    const rendered = await setupRecording(arrangement);

    act(() => pushSamples(1024));
    await act(async () => {
      await rendered.result.current.stopRecording();
    });

    const clips = clipsOf(arrangement, 'track-1') as AudioClip[];
    expect(clips).toHaveLength(2);

    const recorded = clips.find((c) => c.id !== 'existing')!;
    const carved = clips.find((c) => c.id === 'existing')!;

    // The take lands AT the playhead (0), not clamped past the existing clip
    expect(recorded.startSample).toBe(0);
    expect(recorded.durationSamples).toBe(1024);

    // The overlapped head of the existing clip is carved away
    expect(carved.startSample).toBe(1024);
    expect(carved.offsetSamples).toBe(1024);
    expect(carved.durationSamples).toBe(1024);
  });

  it('finalizes the clip against the latest tracks (concurrent edits survive the stop handshake)', async () => {
    const arrangement = arrangementOf([makeTrack('track-1')]);
    const rendered = await setupRecording(arrangement);

    // Push one chunk so the finalized buffer is non-empty
    act(() => pushSamples(1024));

    // Defer the stop ack so the handshake stays in flight while tracks change
    env.recNode.port.postMessage = vi.fn((msg: { command?: string }) => {
      if (msg?.command === 'stop') {
        setTimeout(() => {
          env.recNode.port.onmessage?.({
            data: { channels: [], channelCount: 1, done: true },
          } as MessageEvent);
        }, 20);
      }
    });

    let stopPromise!: Promise<void>;
    act(() => {
      stopPromise = rendered.result.current.stopRecording() as unknown as Promise<void>;
    });

    // A concurrent edit lands while the stop handshake is in flight
    act(() => arrangement.addTrack(makeTrack('track-2')));

    await act(async () => {
      await stopPromise;
    });

    // The concurrently-added track must survive...
    expect(arrangement.getTracks().some((t) => t.id === 'track-2')).toBe(true);
    // ...and the recorded clip lands on track-1
    expect(clipsOf(arrangement, 'track-1')).toHaveLength(1);
  });
});
