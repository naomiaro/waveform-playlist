// #812: useIntegratedRecording works on the arrangement that owns the tracks.
// It reads the tracks from `arrangement.getTracks()` when it needs them, adds
// a take with one `arrangement.updateTrack()` (one undo step), and refuses to
// start on a track that is not in the arrangement or that holds a clip whose
// audio is not loaded (a punch-in can only carve loaded clips).
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { attachDecodeContext, createArrangement } from '@waveform-playlist/engine';
import type { Arrangement, LoadSource } from '@waveform-playlist/engine';
import { isLoadingClip } from '@waveform-playlist/core';
import type { ArrangementTrack, AudioClip, LoadingClip } from '@waveform-playlist/core';
import {
  fakeBuffer,
  pushSamples,
  recordingWorkletStarted,
  resetRecordingEnv,
} from './helpers/recordingEnv';

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

const RATE = 48000;

function track(id: string, clips: ArrangementTrack['clips'] = [], name = id): ArrangementTrack {
  return { id, kind: 'audio', name, clips, muted: false, soloed: false, volume: 1, pan: 0 };
}

function loadedClip(id: string, startSample: number, durationSamples: number): AudioClip {
  return {
    id,
    startSample,
    durationSamples,
    offsetSamples: 0,
    sampleRate: RATE,
    sourceDurationSamples: durationSamples,
    gain: 1,
  };
}

/** A context that is never used to decode: the loadSource of each test decides. */
const DECODE_CONTEXT = { sampleRate: RATE } as unknown as BaseAudioContext;

function arrangementOf(tracks: ArrangementTrack[], loadSource?: LoadSource): Arrangement {
  const arrangement = createArrangement({
    tracks,
    loadSource: loadSource ?? (() => new Promise<AudioBuffer>(() => {})),
  });
  attachDecodeContext(arrangement, async () => DECODE_CONTEXT);
  return arrangement;
}

async function mount(arrangement: Arrangement, selected: string | null = 'track-1') {
  const rendered = renderHook(
    ({ id }: { id: string | null }) => useIntegratedRecording(arrangement, id),
    { initialProps: { id: selected } }
  );
  await act(async () => {
    await rendered.result.current.requestMicAccess();
  });
  return rendered;
}

type Rendered = Awaited<ReturnType<typeof mount>>;

/** Start a take, push `samples`, stop it. Returns what startRecording resolved. */
async function recordTake(rendered: Rendered, samples = 1024): Promise<boolean> {
  let started = false;
  await act(async () => {
    started = await rendered.result.current.startRecording();
  });
  if (!started) return false;
  act(() => pushSamples(samples));
  await act(async () => {
    await rendered.result.current.stopRecording();
  });
  return true;
}

const clipsOf = (arrangement: Arrangement, id: string) =>
  arrangement.getTracks().find((t) => t.id === id)!.clips;

beforeEach(() => {
  resetRecordingEnv(RATE);
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('a take is an edit of the arrangement (#812)', () => {
  it('a take is one undo step and undo removes it', async () => {
    const existing = loadedClip('existing', RATE, RATE);
    const arrangement = arrangementOf([track('track-1', [existing])]);
    const rendered = await mount(arrangement);
    expect(arrangement.canUndo).toBe(false);

    expect(await recordTake(rendered)).toBe(true);
    const clips = clipsOf(arrangement, 'track-1');
    expect(clips).toHaveLength(2);
    const take = clips.find((c) => c.id !== 'existing') as AudioClip;
    expect(take).toMatchObject({ startSample: 0, durationSamples: 1024, offsetSamples: 0 });
    expect(arrangement.canUndo).toBe(true);

    act(() => arrangement.undo());
    expect(clipsOf(arrangement, 'track-1').map((c) => c.id)).toEqual(['existing']);
    // One step: nothing more to undo.
    expect(arrangement.canUndo).toBe(false);
  });

  it('punch-in over a clip that loaded and was never edited carves it', async () => {
    const source: LoadingClip = { id: 'loaded-later', src: '/a.wav' };
    const arrangement = arrangementOf([track('track-1', [source])], async () => fakeBuffer(4096));
    await waitFor(() => expect(isLoadingClip(clipsOf(arrangement, 'track-1')[0])).toBe(false));
    const rendered = await mount(arrangement);

    expect(await recordTake(rendered)).toBe(true);
    const clips = clipsOf(arrangement, 'track-1') as AudioClip[];
    const carved = clips.find((c) => c.id === 'loaded-later')!;
    expect(carved).toMatchObject({ startSample: 1024, offsetSamples: 1024, durationSamples: 3072 });
    expect(clips.find((c) => c.id !== 'loaded-later')).toMatchObject({
      startSample: 0,
      durationSamples: 1024,
    });
  });

  it('a take on a track the app added to an empty arrangement lands on it, and undo removes the take and not the track', async () => {
    const arrangement = arrangementOf([]);
    const rendered = await mount(arrangement, 'new-track');

    let started = false;
    await act(async () => {
      arrangement.addTrack(track('new-track'));
      started = await rendered.result.current.startRecording();
    });
    expect(started).toBe(true);
    act(() => pushSamples(1024));
    await act(async () => {
      await rendered.result.current.stopRecording();
    });
    expect(clipsOf(arrangement, 'new-track')).toHaveLength(1);

    act(() => arrangement.undo());
    expect(arrangement.getTracks().map((t) => t.id)).toEqual(['new-track']);
    expect(clipsOf(arrangement, 'new-track')).toHaveLength(0);
  });

  it('the track a take is recording onto, removed during the take: the take ends with the could-not-be-saved error and changes nothing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const arrangement = arrangementOf([track('track-1'), track('track-2')]);
    const rendered = await mount(arrangement);
    await act(async () => {
      await rendered.result.current.startRecording();
    });
    act(() => pushSamples(1024));
    act(() => arrangement.removeTrack('track-1'));
    const after = arrangement.getTracks();
    await act(async () => {
      await rendered.result.current.stopRecording();
    });

    expect(arrangement.getTracks()).toBe(after);
    expect(rendered.result.current.error?.message).toBe(
      'Recording completed but track "track-1" no longer exists. The recorded audio could not be saved.'
    );
  });

  it('a track that became a MIDI track during the take: the arrangement refuses the take, the hook reports it, nothing changes', async () => {
    const arrangement = arrangementOf([track('track-1')]);
    const rendered = await mount(arrangement);
    await act(async () => {
      await rendered.result.current.startRecording();
    });
    act(() => pushSamples(1024));
    act(() => arrangement.updateTrack('track-1', (t) => ({ ...t, kind: 'midi' })));
    const after = arrangement.getTracks();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await act(async () => {
      await rendered.result.current.stopRecording();
    });

    expect(arrangement.getTracks()).toBe(after);
    const error = rendered.result.current.error as Error & { cause?: unknown };
    expect(error.message).toMatch(
      /^Recording completed but the take could not be saved on track "track-1": \[waveform-playlist\] Track "track-1" is an midi track/
    );
    // The arrangement's own error is kept.
    expect(error.cause).toBeInstanceOf(Error);
    expect(error.message.endsWith((error.cause as Error).message)).toBe(true);
    expect(warn).toHaveBeenCalledWith(`[waveform-playlist] ${error.message}`);
  });
});

describe('startRecording refuses before anything is recorded (#812)', () => {
  async function refusal(arrangement: Arrangement, selected = 'track-1') {
    const rendered = await mount(arrangement, selected);
    const tracksBefore = arrangement.getTracks();
    let started: boolean | undefined;
    await act(async () => {
      started = await rendered.result.current.startRecording();
    });
    expect(started).toBe(false);
    expect(rendered.result.current.isRecording).toBe(false);
    expect(rendered.result.current.recordingTrackId).toBeNull();
    expect(recordingWorkletStarted()).toBe(false);
    expect(arrangement.getTracks()).toBe(tracksBefore);
    return rendered.result.current.error?.message;
  }

  it('refuses over a pending clip, a failed load and an unusable clip, each with its own message', async () => {
    const pending = arrangementOf([track('track-1', [{ id: 'p', src: '/pending.wav' }], 'Vocals')]);
    expect(await refusal(pending)).toBe(
      'Cannot start recording: "Vocals" holds a clip whose audio is still loading ("p"). ' +
        'Start the take once it has loaded.'
    );

    const failed = arrangementOf(
      [track('track-1', [{ id: 'f', src: '/missing.wav' }], 'Vocals')],
      async () => {
        throw new Error('404 Not Found');
      }
    );
    await waitFor(() => expect(failed.sources.getSnapshot().failedCount).toBe(1));
    expect(await refusal(failed)).toBe(
      'Cannot start recording: the audio of clip "f" on "Vocals" could not be loaded ' +
        '(404 Not Found). Retry it with arrangement.retry(), or remove the clip.'
    );

    // An offset past the end of the audio: the audio loads, the clip cannot be made.
    const unusable = arrangementOf(
      [track('track-1', [{ id: 'u', src: '/short.wav', offset: 10 }], 'Vocals')],
      async () => fakeBuffer(1000)
    );
    await waitFor(() => expect(unusable.sources.getSnapshot().failedCount).toBe(1));
    expect(await refusal(unusable)).toBe(
      'Cannot start recording: a clip on "Vocals" cannot be made from its audio ' +
        '(clip "u": offset is at or past the end of the audio). Correct or remove the clip.'
    );
  });

  it('refuses a selected track id the arrangement does not hold, naming it', async () => {
    const arrangement = arrangementOf([track('track-1')]);
    expect(await refusal(arrangement, 'not-there')).toBe(
      'Cannot start recording: the selected track "not-there" is not in the arrangement. ' +
        'Add it with arrangement.addTrack() first.'
    );
  });

  it('a track added in the same handler as the start is accepted', async () => {
    const arrangement = arrangementOf([]);
    const rendered = await mount(arrangement, 'added');
    let started: boolean | undefined;
    await act(async () => {
      arrangement.addTrack(track('added'));
      started = await rendered.result.current.startRecording();
    });
    expect(started).toBe(true);
    expect(rendered.result.current.recordingTrackId).toBe('added');
    expect(rendered.result.current.error).toBeNull();
  });
});
