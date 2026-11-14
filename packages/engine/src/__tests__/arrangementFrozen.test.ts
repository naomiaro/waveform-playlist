/**
 * What the arrangement and the engine hand out is shared, not copied, so it
 * must not be written to. The types say so (`readonly`), and outside
 * production builds the objects are frozen, so a write fails where it is
 * made instead of corrupting the undo history (#812).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createClip, createTrack } from '@waveform-playlist/core';
import type { AudioClip, ClipTrack } from '@waveform-playlist/core';
import { ArrangementImpl as Arrangement } from '../arrangement/Arrangement';
import { PlaylistEngine } from '../PlaylistEngine';
import type { EngineState } from '../types';
import { recordingAdapter } from './helpers/recordingAdapter';
import { loaded } from './helpers/loadedTracks';

const SAMPLE_RATE = 48000;

function timeBase() {
  return {
    sampleRate: SAMPLE_RATE,
    ppqn: 960,
    secondsToTicks: (seconds: number) => Math.round(seconds * 1920),
    ticksToSeconds: (tick: number) => tick / 1920,
  };
}

function clip(id: string, startSample: number): AudioClip {
  return {
    ...createClip({
      startSample,
      durationSamples: 48000,
      offsetSamples: 0,
      sampleRate: SAMPLE_RATE,
      sourceDurationSamples: 96000,
    }),
    id,
  };
}

function track(id: string, clips: AudioClip[]): ClipTrack {
  return { ...createTrack({ name: id, clips }), id };
}

function fixture(): ClipTrack[] {
  return [track('A', [clip('a1', 0), clip('a2', 96000)]), track('B', [clip('b1', 0)])];
}

/** A track, its clips array and each clip. */
function expectTrackFrozen(t: ClipTrack, frozen: boolean): void {
  expect(Object.isFrozen(t)).toBe(frozen);
  expect(Object.isFrozen(t.clips)).toBe(frozen);
  for (const c of t.clips) expect(Object.isFrozen(c)).toBe(frozen);
}

/** The four levels a consumer could write to. */
function expectFrozen(tracks: readonly ClipTrack[], frozen: boolean): void {
  expect(Object.isFrozen(tracks)).toBe(frozen);
  for (const t of tracks) expectTrackFrozen(t, frozen);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('outside production builds', () => {
  it('a write to the arrangement’s tracks throws where it is made', () => {
    const arrangement = new Arrangement({ timeBase: timeBase() });
    arrangement.setTracks(fixture());
    const tracks = arrangement.getTracks() as ClipTrack[];
    expect(() => tracks.push(track('C', []))).toThrow(TypeError);
    expect(() => {
      tracks[0].name = 'renamed';
    }).toThrow(TypeError);
    expect(() => tracks[0].clips.push(clip('late', 0))).toThrow(TypeError);
    expect(() => {
      tracks[0].clips[0].startSample = 7;
    }).toThrow(TypeError);
    expect(arrangement.getTracks()[0].name).toBe('A');
  });

  it('every state the arrangement moves through is frozen', () => {
    const arrangement = new Arrangement({ timeBase: timeBase() });
    const steps: Array<() => void> = [
      () => arrangement.setTracks(fixture()),
      () => void arrangement.addTrack(track('C', [clip('c1', 0)])),
      () => void arrangement.updateTrack('C', track('C', [clip('c2', 0)])),
      () => void arrangement.moveClip('A', 'a1', 1000),
      () => arrangement.trimClip('A', 'a1', 'right', -1000),
      () => arrangement.splitClip('A', 'a2', 120000),
      () => arrangement.reorderTrack('A', 2),
      () => arrangement.removeTrack('B'),
      () => arrangement.setTrackVolume('A', 0.5),
      () => arrangement.recomputeStartSamples(),
      () => arrangement.undo(),
      () => arrangement.redo(),
    ];
    for (const step of steps) {
      step();
      expectFrozen(loaded(arrangement), true);
    }
  });

  it('the caller’s own objects are not frozen', () => {
    const arrangement = new Arrangement({ timeBase: timeBase() });
    const given = fixture();
    arrangement.setTracks(given);
    const added = track('C', [clip('c1', 0)]);
    arrangement.addTrack(added);
    expectFrozen(given, false);
    expectTrackFrozen(added, false);
    given[0].name = 'still mine';
    expect(arrangement.getTracks()[0].name).toBe('A');
  });

  it('what a clip refers to is not frozen', () => {
    const arrangement = new Arrangement({ timeBase: timeBase() });
    const fade = { duration: 1 };
    arrangement.setTracks([track('A', [{ ...clip('a1', 0), fadeIn: fade }])]);
    expect(Object.isFrozen(arrangement.getTracks()[0].clips[0].fadeIn)).toBe(false);
  });

  it('getState().tracks is frozen, also the tracks that carry a changed mix', () => {
    const engine = new PlaylistEngine({ sampleRate: SAMPLE_RATE });
    engine.setTracks(fixture());
    expectFrozen(engine.getState().tracks, true);
    engine.setTrackVolume('A', 0.4);
    const tracks = engine.getState().tracks;
    expect(tracks[0].volume).toBe(0.4);
    expectFrozen(tracks, true);
    expect(() => {
      (tracks as ClipTrack[])[0].volume = 1;
    }).toThrow(TypeError);
  });

  it('what the adapter is sent is frozen', () => {
    const adapter = recordingAdapter();
    const engine = new PlaylistEngine({ adapter, sampleRate: SAMPLE_RATE });
    engine.setTracks(fixture());
    engine.setTrackPan('A', 0.5);
    engine.moveClip('A', 'a1', 1000);
    engine.addTrack(track('C', []));
    const sets = adapter.rawCalls[0].args[0] as ClipTrack[];
    const updated = adapter.rawCalls.find((c) => c.method === 'updateTrack')?.args[1] as ClipTrack;
    const added = adapter.rawCalls.find((c) => c.method === 'addTrack')?.args[0] as ClipTrack;
    expectFrozen(sets, true);
    expectTrackFrozen(updated, true);
    expectTrackFrozen(added, true);
  });
});

describe('outside production builds, at the moment the adapter is called', () => {
  it('a track that carries a changed mix is already frozen when the adapter receives it', () => {
    const adapter = recordingAdapter();
    const frozenAtCall: boolean[] = [];
    const updateTrack = adapter.updateTrack!;
    adapter.updateTrack = (trackId, sent) => {
      frozenAtCall.push(Object.isFrozen(sent) && Object.isFrozen(sent.clips));
      updateTrack(trackId, sent);
    };
    const engine = new PlaylistEngine({ adapter, sampleRate: SAMPLE_RATE });
    engine.setTracks(fixture());
    engine.setTrackVolume('A', 0.4);
    // No listener and no getState() in between: nothing else has frozen it.
    engine.updateTrack('A');
    engine.moveClip('A', 'a1', 1000);
    expect(frozenAtCall).toEqual([true, true]);
  });
});

describe('in a production build', () => {
  it('nothing is frozen', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const engine = new PlaylistEngine({ sampleRate: SAMPLE_RATE });
    engine.setTracks(fixture());
    engine.setTrackVolume('A', 0.4);
    engine.moveClip('A', 'a1', 1000);
    expectFrozen(engine.getState().tracks, false);
  });
});

describe('the types', () => {
  it('EngineState.tracks is a readonly array', () => {
    const engine = new PlaylistEngine({ sampleRate: SAMPLE_RATE });
    engine.setTracks(fixture());
    const state: EngineState = engine.getState();
    // @ts-expect-error tracks is readonly: no push
    const push = () => state.tracks.push(track('C', []));
    // @ts-expect-error tracks is readonly: no index write
    const write = () => (state.tracks[0] = track('C', []));
    expect(push).toThrow(TypeError);
    expect(write).toThrow(TypeError);
    // Reading and copying are what a consumer does.
    const copy: ClipTrack[] = [...state.tracks];
    expect(copy).toHaveLength(2);
  });

  it('setTracks accepts a readonly array', () => {
    const engine = new PlaylistEngine({ sampleRate: SAMPLE_RATE });
    const tracks: readonly ClipTrack[] = fixture();
    engine.setTracks(tracks);
    engine.setTracks(engine.getState().tracks);
    expect(engine.getState().tracks).toHaveLength(2);
  });
});
