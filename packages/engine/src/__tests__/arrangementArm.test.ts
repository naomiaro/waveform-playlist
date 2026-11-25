/**
 * The recording arm (#843): a set of armed track ids that the arrangement
 * keeps outside the history. An armed track plays muted (the engine's
 * projection and the adapter have `muted: stored || armed`), while the
 * stored mute in `getMixer()` is never touched. Arming is no undo step, and
 * undo, redo, abort, `setTracks` and `clearHistory` leave the set alone.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClip, createTrack } from '@waveform-playlist/core';
import type { AudioClip, ClipTrack } from '@waveform-playlist/core';
import { ArrangementImpl as Arrangement } from '../arrangement/Arrangement';
import type { ArrangementChange } from '../arrangement/Arrangement';
import { PlaylistEngine } from '../PlaylistEngine';
import { recordingAdapter } from './helpers/recordingAdapter';
import type { AdapterCall } from './helpers/recordingAdapter';

const SAMPLE_RATE = 48000;

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
  return [track('A', [clip('a1', 0)]), track('B', [clip('b1', 0)])];
}

function setup() {
  const arrangement = new Arrangement();
  arrangement.setTracks(fixture());
  const adapter = recordingAdapter();
  const engine = new PlaylistEngine({ arrangement, adapter, sampleRate: SAMPLE_RATE });
  const changes: ArrangementChange[] = [];
  arrangement.onChange((change) => changes.push(change));
  adapter.reset();
  return { arrangement, adapter, engine, changes };
}

const muteCall = (trackId: string, muted: boolean): AdapterCall => ({
  method: 'setTrackMute',
  args: [trackId, muted],
});

const mutedInState = (engine: PlaylistEngine, trackId = 'A'): boolean | undefined =>
  engine.getState().tracks.find((t) => t.id === trackId)?.muted;

const muteCalls = (calls: readonly AdapterCall[]): AdapterCall[] =>
  calls.filter((call) => call.method === 'setTrackMute');

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('the recording arm', () => {
  it('an armed track plays muted and its stored mute is untouched', () => {
    const { arrangement, adapter, engine } = setup();
    arrangement.setTrackArmed('A', true);
    expect(mutedInState(engine)).toBe(true);
    expect(arrangement.getMixer().get('A')?.muted).toBe(false);
    expect(adapter.calls).toEqual([muteCall('A', true)]);
    expect(arrangement.armedTrackIds.has('A')).toBe(true);

    adapter.reset();
    arrangement.setTrackArmed('A', false);
    expect(mutedInState(engine)).toBe(false);
    expect(adapter.calls).toEqual([muteCall('A', false)]);
    expect(arrangement.armedTrackIds.has('A')).toBe(false);
  });

  it('disarming a track whose stored mute is on leaves it muted', () => {
    const { arrangement, adapter, engine } = setup();
    arrangement.setTrackMute('A', true);
    arrangement.setTrackArmed('A', true);
    adapter.reset();
    arrangement.setTrackArmed('A', false);
    expect(mutedInState(engine)).toBe(true);
    expect(adapter.calls).toEqual([muteCall('A', true)]);
  });

  it('arming is not an undo step and undo does not change it', () => {
    const { arrangement, engine } = setup();
    arrangement.setTrackArmed('A', true);
    expect(arrangement.canUndo).toBe(false);
    expect(arrangement.canRedo).toBe(false);

    arrangement.moveClip('A', 'a1', 1000);
    arrangement.undo();
    expect(arrangement.armedTrackIds.has('A')).toBe(true);
    expect(mutedInState(engine)).toBe(true);
    arrangement.redo();
    expect(arrangement.armedTrackIds.has('A')).toBe(true);
    expect(mutedInState(engine)).toBe(true);
  });

  it('arming keeps the redo states', () => {
    const { arrangement } = setup();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.undo();
    arrangement.setTrackArmed('A', true);
    expect(arrangement.canRedo).toBe(true);
  });

  it('arming inside a transaction is not taken back by abort, and a commit of only an arm pushes nothing', () => {
    const { arrangement } = setup();
    arrangement.beginTransaction();
    arrangement.setTrackArmed('A', true);
    arrangement.abortTransaction();
    expect(arrangement.armedTrackIds.has('A')).toBe(true);

    arrangement.beginTransaction();
    arrangement.setTrackArmed('A', false);
    arrangement.commitTransaction();
    expect(arrangement.canUndo).toBe(false);
    expect(arrangement.armedTrackIds.has('A')).toBe(false);
  });

  it('setTracks and clearHistory leave the armed set alone', () => {
    const { arrangement, engine } = setup();
    arrangement.setTrackArmed('A', true);
    const armed = arrangement.armedTrackIds;
    arrangement.clearHistory();
    arrangement.setTracks(fixture());
    expect(arrangement.armedTrackIds).toBe(armed);
    expect(mutedInState(engine)).toBe(true);
  });

  it('arming does not split a gesture', () => {
    const { arrangement } = setup();
    arrangement.setTrackVolume('A', 0.5, { gesture: 'g' });
    arrangement.setTrackArmed('B', true);
    arrangement.setTrackVolume('A', 0.4, { gesture: 'g' });
    arrangement.undo();
    expect(arrangement.getMixer().get('A')?.volume).toBe(1);
    expect(arrangement.canUndo).toBe(false);
  });

  it('a mute set while armed still plays muted', () => {
    const { arrangement, adapter, engine } = setup();
    arrangement.setTrackArmed('A', true);
    adapter.reset();
    // Through the engine: its first call gives the value the track already has.
    engine.setTrackMute('A', false);
    engine.setTrackMute('A', true);
    engine.setTrackMute('A', false);
    expect(muteCalls(adapter.calls)).not.toContainEqual(muteCall('A', false));
    expect(mutedInState(engine)).toBe(true);
    // And through the arrangement.
    arrangement.setTrackMute('A', true);
    arrangement.setTrackMute('A', false);
    expect(muteCalls(adapter.calls)).not.toContainEqual(muteCall('A', false));
    expect(arrangement.getMixer().get('A')?.muted).toBe(false);

    adapter.reset();
    arrangement.setTrackArmed('A', false);
    expect(adapter.calls).toEqual([muteCall('A', false)]);
    expect(mutedInState(engine)).toBe(false);
  });

  it('an undo that brings back an unmuted mix on an armed track does not unmute it', () => {
    const { arrangement, adapter, engine } = setup();
    arrangement.setTrackMute('A', true);
    arrangement.setTrackArmed('A', true);
    adapter.reset();
    arrangement.undo(); // the stored mute goes back to false
    expect(arrangement.getMixer().get('A')?.muted).toBe(false);
    expect(muteCalls(adapter.calls)).not.toContainEqual(muteCall('A', false));
    expect(mutedInState(engine)).toBe(true);

    arrangement.redo();
    arrangement.undo();
    expect(muteCalls(adapter.calls)).not.toContainEqual(muteCall('A', false));

    adapter.reset();
    arrangement.setTrackArmed('A', false);
    expect(adapter.calls).toEqual([muteCall('A', false)]);
  });

  it('an undo of a move with a mute change in one step keeps an armed track muted', () => {
    const { arrangement, adapter, engine } = setup();
    arrangement.beginTransaction();
    arrangement.moveClip('A', 'a1', 1000);
    arrangement.setTrackMute('A', true);
    arrangement.commitTransaction();
    arrangement.setTrackArmed('A', true);
    adapter.reset();
    arrangement.undo();
    expect(muteCalls(adapter.calls)).not.toContainEqual(muteCall('A', false));
    expect(mutedInState(engine)).toBe(true);
  });

  it('an arm change increments mixerVersion, not tracksVersion', () => {
    const { arrangement } = setup();
    const { tracksVersion, mixerVersion } = arrangement;
    arrangement.setTrackArmed('A', true);
    expect(arrangement.mixerVersion).toBe(mixerVersion + 1);
    expect(arrangement.tracksVersion).toBe(tracksVersion);
    arrangement.setTrackArmed('A', false);
    expect(arrangement.mixerVersion).toBe(mixerVersion + 2);
    expect(arrangement.tracksVersion).toBe(tracksVersion);
  });

  it('an arm change is announced as an arm, and the mixer Map stays the same object', () => {
    const { arrangement, changes } = setup();
    const mixer = arrangement.getMixer();
    const subscriber = vi.fn();
    arrangement.subscribe(subscriber);
    arrangement.setTrackArmed('A', true);
    expect(changes).toEqual([{ type: 'arm', trackId: 'A' }]);
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(arrangement.getMixer()).toBe(mixer);
  });

  it('the armed set is replaced on a change and is the same Set until then', () => {
    const { arrangement } = setup();
    const before = arrangement.armedTrackIds;
    expect(before.size).toBe(0);
    arrangement.setTrackArmed('A', true);
    const armed = arrangement.armedTrackIds;
    expect(armed).not.toBe(before);
    expect(before.size).toBe(0);
    expect(arrangement.armedTrackIds).toBe(armed);
    arrangement.setTrackArmed('B', true);
    expect([...arrangement.armedTrackIds]).toEqual(['A', 'B']);
    expect([...armed]).toEqual(['A']);
  });

  it('the projection is the same array until an arm changes it, and other tracks keep their objects', () => {
    const { arrangement, engine } = setup();
    const before = engine.getState().tracks;
    expect(engine.getState().tracks).toBe(before);
    arrangement.setTrackArmed('A', true);
    const after = engine.getState().tracks;
    expect(after).not.toBe(before);
    expect(after[1]).toBe(before[1]);
    arrangement.setTrackArmed('A', false);
    expect(engine.getState().tracks[0]).toBe(before[0]);
  });

  it('an armed id not in the tracks mutes nothing until it enters', () => {
    const { arrangement, adapter, engine, changes } = setup();
    const { mixerVersion, tracksVersion } = arrangement;
    const tracks = engine.getState().tracks;
    arrangement.setTrackArmed('C', true);
    expect(arrangement.armedTrackIds.has('C')).toBe(true);
    // Rule (my call, #843): the set changed, so it is announced; the
    // projection cannot change, so mixerVersion stays.
    expect(changes).toEqual([{ type: 'arm', trackId: 'C' }]);
    expect(arrangement.mixerVersion).toBe(mixerVersion);
    expect(arrangement.tracksVersion).toBe(tracksVersion);
    expect(engine.getState().tracks).toBe(tracks);
    expect(adapter.calls).toEqual([]);

    arrangement.addTrack(track('C', [clip('c1', 0)]));
    expect(mutedInState(engine, 'C')).toBe(true);
    expect(arrangement.getMixer().get('C')?.muted).toBe(false);
    const added = adapter.calls.find((call) => call.method === 'addTrack');
    expect(added).toBeDefined();
    const sent = adapter.rawCalls.find((call) => call.method === 'addTrack')?.args[0] as ClipTrack;
    expect(sent.muted).toBe(true);
  });

  it('an armed track that is removed and brought back by undo is armed again', () => {
    const { arrangement, engine } = setup();
    arrangement.setTrackArmed('A', true);
    arrangement.removeTrack('A');
    expect(arrangement.armedTrackIds.has('A')).toBe(true);
    arrangement.undo();
    expect(mutedInState(engine)).toBe(true);
    expect(arrangement.getMixer().get('A')?.muted).toBe(false);
  });

  it('arming the same value twice does nothing', () => {
    const { arrangement, adapter, changes } = setup();
    arrangement.setTrackArmed('A', true);
    const armed = arrangement.armedTrackIds;
    const { mixerVersion } = arrangement;
    changes.length = 0;
    adapter.reset();
    arrangement.setTrackArmed('A', true);
    arrangement.setTrackArmed('B', false);
    arrangement.setTrackArmed('C', false);
    expect(changes).toEqual([]);
    expect(adapter.calls).toEqual([]);
    expect(arrangement.mixerVersion).toBe(mixerVersion);
    expect(arrangement.armedTrackIds).toBe(armed);
  });

  it("the engine's setter for a track it does not hold still calls the adapter with the value given", () => {
    const { arrangement, adapter, engine } = setup();
    arrangement.setTrackArmed('C', true);
    engine.setTrackMute('C', false);
    expect(adapter.calls).toEqual([muteCall('C', false)]);

    // The arm applies once the track enters.
    arrangement.addTrack(track('C', [clip('c1', 0)]));
    expect(mutedInState(engine, 'C')).toBe(true);
  });
});
