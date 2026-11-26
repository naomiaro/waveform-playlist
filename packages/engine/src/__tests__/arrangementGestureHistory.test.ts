/**
 * A gesture keeps the history from before its step was pushed (`before`),
 * and puts it back when the gesture returns to where it began (#843). These
 * tests pin what keeps that history in step with the arrangement: the time
 * base an engine attaches, the switch to loaded clips and the sources it
 * names. And an `undoable: false` write that makes the step below the
 * gesture's equal to it does not split the drag (review #909).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClip, createTrack, isLoadingClip } from '@waveform-playlist/core';
import type { ArrangementTrack, AudioClip, ClipSource, LoadingClip } from '@waveform-playlist/core';
import { attachDecodeContext, createArrangement } from '../index';
import type { LoadSource } from '../index';
import { ArrangementImpl as Arrangement } from '../arrangement/Arrangement';

const RATE = 48000;

function timeBase() {
  return {
    sampleRate: RATE,
    ppqn: 960,
    secondsToTicks: (seconds: number) => Math.round(seconds * 1920),
    ticksToSeconds: (tick: number) => tick / 1920,
  };
}

function clip(id: string, startSample: number): AudioClip {
  return {
    ...createClip({
      startSample,
      durationSamples: RATE,
      offsetSamples: 0,
      sampleRate: RATE,
      sourceDurationSamples: 4 * RATE,
    }),
    id,
  };
}

function loading(id: string, src: ClipSource): LoadingClip {
  return { id, src, start: 0, duration: 1 } as LoadingClip;
}

function track(id: string, clips: ArrangementTrack['clips']): ArrangementTrack {
  return { ...createTrack({ name: id, clips: [] }), id, clips } as ArrangementTrack;
}

const fakeBuffer = (): AudioBuffer =>
  ({ sampleRate: RATE, length: 4 * RATE, duration: 4, numberOfChannels: 1 }) as AudioBuffer;

interface PendingLoad {
  src: ClipSource;
  signal: AbortSignal;
  resolve(buffer: AudioBuffer): void;
}

/** A `loadSource` that keeps every call pending until the test settles it. */
function fakeLoads() {
  const calls: PendingLoad[] = [];
  const loadSource: LoadSource = (src, { signal }) =>
    new Promise<AudioBuffer>((resolve) => {
      calls.push({ src, signal, resolve });
    });
  const of = (src: ClipSource) => calls.filter((call) => call.src === src);
  return { calls, loadSource, of };
}

/** Let promise callbacks run: a load starts, or a settled load is applied. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const CONTEXT = { fake: 'decode context' } as unknown as BaseAudioContext;

const volumeOf = (
  arrangement: { getMixer(): ReadonlyMap<string, { volume: number }> },
  id: string
) => arrangement.getMixer().get(id)?.volume;

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("a gesture's saved history follows the arrangement (review #909)", () => {
  it('an engine that attaches during the gesture gives ticks to the history that comes back', () => {
    // No time base yet: the clip has no tick.
    const arrangement = new Arrangement({ tracks: [track('A', [clip('a1', RATE)])] });
    arrangement.updateTrack('A', (t) => ({ ...t, name: 'A2' })); // a step with a tickless clip
    arrangement.setTrackVolume('A', 0.5, { gesture: 'g' });
    arrangement.attachEngine(timeBase());
    arrangement.setTrackVolume('A', 1, { gesture: 'g' }); // back where it began

    arrangement.undo(); // the rename
    expect(arrangement.getTracks()[0].name).toBe('A');
    expect((arrangement.getTracks()[0].clips[0] as AudioClip).startTick).toBe(1920);
  });

  it('audio that arrives during the gesture is loaded in the history that comes back', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({
      tracks: [track('A', [loading('L1', 'a.opus')]), track('B', [])],
      loadSource: loads.loadSource,
    });
    attachDecodeContext(arrangement, async () => CONTEXT);
    await flush();
    arrangement.setTrackVolume('B', 0.5); // a step with the same tracks
    arrangement.setTrackVolume('A', 0.6, { gesture: 'g' });
    loads.of('a.opus')[0].resolve(fakeBuffer());
    await flush();
    expect(isLoadingClip(arrangement.getTracks()[0].clips[0])).toBe(false);
    arrangement.setTrackVolume('A', 1, { gesture: 'g' }); // back where it began

    const loadedA = arrangement.getTracks()[0];
    arrangement.undo(); // B's volume: the step holds A as loaded already

    expect(volumeOf(arrangement, 'B')).toBe(1);
    // The same track object: the step was switched with the others, not
    // brought back loading and switched again.
    expect(arrangement.getTracks()[0]).toBe(loadedA);
  });

  it('a source named only by a step the gesture evicted stays wanted while the gesture is open', async () => {
    const loads = fakeLoads();
    const arrangement = createArrangement({
      tracks: [track('A', [loading('L1', 'a.opus')]), track('B', [loading('L2', 'b.opus')])],
      loadSource: loads.loadSource,
      undoLimit: 1,
    });
    attachDecodeContext(arrangement, async () => CONTEXT);
    await flush();
    arrangement.updateTrack('A', (t) => ({ ...t, clips: [] })); // only this step names a.opus
    arrangement.setTrackVolume('B', 0.6, { gesture: 'g' }); // evicts it (limit 1)
    // b.opus arrives: the arrangement declares the sources its states name.
    loads.of('b.opus')[0].resolve(fakeBuffer());
    await flush();
    expect(loads.of('a.opus')[0].signal.aborted).toBe(false);

    arrangement.setTrackVolume('B', 1, { gesture: 'g' }); // the evicted step comes back
    arrangement.undo();
    await flush();
    expect(isLoadingClip(arrangement.getTracks()[0].clips[0])).toBe(true);
    expect(loads.of('a.opus')).toHaveLength(1); // not fetched again
  });
});

describe('an undoable: false write does not split a drag (review #909)', () => {
  it('when it makes the step below the gesture equal to the gesture step', () => {
    const arrangement = new Arrangement({ tracks: [track('A', []), track('B', [])] });
    arrangement.setTrackVolume('B', 0.5); // step X: A 1, B 1
    arrangement.setTrackVolume('A', 0.6, { gesture: 'g' }); // step S: A 1, B 0.5
    arrangement.setTrackVolume('B', 1, { undoable: false }); // X and S both A 1, B 1
    arrangement.setTrackVolume('A', 0.4, { gesture: 'g' }); // still the drag

    arrangement.undo();
    expect(volumeOf(arrangement, 'A')).toBe(1);
    expect(volumeOf(arrangement, 'B')).toBe(1);
    expect(arrangement.canUndo).toBe(false);
  });

  it('and the drag still leaves no step when it comes back', () => {
    const arrangement = new Arrangement({ tracks: [track('A', []), track('B', [])] });
    arrangement.setTrackVolume('B', 0.5);
    arrangement.setTrackVolume('A', 0.6, { gesture: 'g' });
    arrangement.setTrackVolume('B', 1, { undoable: false });
    arrangement.setTrackVolume('A', 1, { gesture: 'g' });

    // Every step would now change nothing (B's step was written over too).
    expect(arrangement.canUndo).toBe(false);
  });
});
