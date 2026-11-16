import { renderHook, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createArrangement } from '@waveform-playlist/engine';
import type { Arrangement } from '@waveform-playlist/engine';
import type { ArrangementTrack, AudioClip } from '@waveform-playlist/core';
import { env, pushSamples, resetRecordingEnv } from './helpers/recordingEnv';

/**
 * Latency compensation of a finalized take, run through useIntegratedRecording
 * on an arrangement (#812).
 *
 * Two sources of delay between worklet capture and audible playback:
 * 1. Tone.js lookAhead (~100ms) — Transport schedules audio ahead of real time
 * 2. outputLatency — hardware DAC delay before audio reaches speakers
 *
 * The clip's offsetSamples skips this combined latency period, and
 * durationSamples is reduced by the same amount. A take shorter than the
 * compensation is discarded.
 */

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

interface TakeInput {
  bufferLength: number;
  sampleRate: number;
  outputLatency: number;
  lookAhead: number;
  overrideSeconds?: number;
  recordingStartTime: number;
  /** Clips already on the track. */
  clips?: AudioClip[];
}

interface TakeResult {
  startSample: number;
  offsetSamples: number;
  durationSamples: number;
  discarded: boolean;
  error: Error | null;
}

const TRACK_ID = 'track-1';

/** Record one take of `bufferLength` samples and read it back from the arrangement. */
async function recordTake(input: TakeInput): Promise<TakeResult> {
  resetRecordingEnv(input.sampleRate);
  env.rawAudioContext.outputLatency = input.outputLatency;
  env.context.lookAhead = input.lookAhead;
  const existing = input.clips ?? [];
  const track = { id: TRACK_ID, name: TRACK_ID, clips: existing } as ArrangementTrack;
  const arrangement: Arrangement = createArrangement({ tracks: [track] });
  const { result } = renderHook(() =>
    useIntegratedRecording(arrangement, TRACK_ID, {
      currentTime: input.recordingStartTime,
      latencyOffset: input.overrideSeconds,
    })
  );
  await act(async () => {
    await result.current.requestMicAccess();
  });
  await act(async () => {
    await result.current.startRecording();
  });
  act(() => pushSamples(input.bufferLength));
  await act(async () => {
    await result.current.stopRecording();
  });

  // The take is the one clip with an AudioBuffer: a carve of an existing clip
  // can leave a piece of it with a new id.
  const clips = arrangement.getTracks()[0].clips as AudioClip[];
  const take = clips.find((c) => c.audioBuffer !== undefined);
  return {
    startSample: take?.startSample ?? -1,
    offsetSamples: take?.offsetSamples ?? -1,
    durationSamples: take?.durationSamples ?? 0,
    discarded: take === undefined,
    error: result.current.error,
  };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('latency compensation', () => {
  const defaultInput: TakeInput = {
    bufferLength: 44100, // 1 second
    sampleRate: 44100,
    outputLatency: 0.01, // 10ms
    lookAhead: 0.1, // 100ms (Tone.js default)
    recordingStartTime: 0,
  };

  it('computes correct offset for typical latency values', async () => {
    const result = await recordTake(defaultInput);

    // totalLatency = 0.01 + 0.1 = 0.11s → floor(0.11 * 44100) = 4851 samples
    expect(result.offsetSamples).toBe(4851);
    expect(result.durationSamples).toBe(44100 - 4851);
    expect(result.discarded).toBe(false);
  });

  it('discards recording shorter than latency compensation', async () => {
    const result = await recordTake({
      ...defaultInput,
      bufferLength: 100, // very short: 100 samples < 4851 offset
    });

    expect(result.discarded).toBe(true);
    expect(result.error?.message).toBe(
      'Recording was too short to save. Try recording for longer.'
    );
  });

  it('handles zero latency', async () => {
    const result = await recordTake({
      ...defaultInput,
      outputLatency: 0,
      lookAhead: 0,
    });

    expect(result.offsetSamples).toBe(0);
    expect(result.durationSamples).toBe(44100);
    expect(result.discarded).toBe(false);
  });

  it('handles only outputLatency (no lookAhead)', async () => {
    const result = await recordTake({
      ...defaultInput,
      outputLatency: 0.02, // 20ms
      lookAhead: 0,
    });

    // floor(0.02 * 44100) = 882
    expect(result.offsetSamples).toBe(882);
    expect(result.durationSamples).toBe(44100 - 882);
  });

  it('handles only lookAhead (no outputLatency)', async () => {
    const result = await recordTake({
      ...defaultInput,
      outputLatency: 0,
      lookAhead: 0.1,
    });

    // floor(0.1 * 44100) = 4410
    expect(result.offsetSamples).toBe(4410);
    expect(result.durationSamples).toBe(44100 - 4410);
  });

  it('uses recordingStartTime for clip placement', async () => {
    const result = await recordTake({
      ...defaultInput,
      recordingStartTime: 2.5, // Start recording at 2.5s
    });

    // floor(2.5 * 44100) = 110250
    expect(result.startSample).toBe(110250);
  });

  // Punch-in (#579): the take lands where it was started, also over a clip
  // that ends later; the take does not move after the clip.
  it('a take started inside an existing clip lands where it was started', async () => {
    const existing: AudioClip = {
      id: 'existing',
      startSample: 0,
      durationSamples: 88200, // ends at 2s, later than the start of the take
      offsetSamples: 0,
      sampleRate: 44100,
      sourceDurationSamples: 88200,
      gain: 1,
    };
    const result = await recordTake({
      ...defaultInput,
      recordingStartTime: 1.0,
      clips: [existing],
    });

    expect(result.startSample).toBe(44100);
  });

  it('handles 48kHz sample rate', async () => {
    const result = await recordTake({
      ...defaultInput,
      sampleRate: 48000,
      bufferLength: 48000,
    });

    // floor(0.11 * 48000) = 5280
    expect(result.offsetSamples).toBe(5280);
    expect(result.durationSamples).toBe(48000 - 5280);
  });

  it('buffer exactly equal to latency offset is discarded', async () => {
    const result = await recordTake({
      ...defaultInput,
      bufferLength: 4851, // exactly the latency offset
    });

    expect(result.discarded).toBe(true);
  });

  it('buffer one sample longer than latency offset is kept', async () => {
    const result = await recordTake({
      ...defaultInput,
      bufferLength: 4852, // one sample more than latency offset
    });

    expect(result.durationSamples).toBe(1);
    expect(result.discarded).toBe(false);
  });

  it('large outputLatency does not produce negative duration', async () => {
    const result = await recordTake({
      ...defaultInput,
      outputLatency: 1.0, // unrealistically large: 1s
      lookAhead: 0.1,
      bufferLength: 44100, // 1 second buffer
    });

    // totalLatency = 1.1s, offset = floor(1.1 * 44100) = 48510 > 44100
    expect(result.discarded).toBe(true);
  });

  it('override seconds replaces the auto-computed latency', async () => {
    const result = await recordTake({
      ...defaultInput,
      overrideSeconds: 0.05, // 50ms wins over auto (0.11s)
    });

    // floor(0.05 * 44100) = 2205
    expect(result.offsetSamples).toBe(2205);
    expect(result.durationSamples).toBe(44100 - 2205);
  });

  it('override of 0 disables compensation', async () => {
    const result = await recordTake({
      ...defaultInput,
      overrideSeconds: 0,
    });

    expect(result.offsetSamples).toBe(0);
    expect(result.durationSamples).toBe(44100);
  });
});
