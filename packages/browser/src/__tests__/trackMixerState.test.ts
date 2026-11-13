// #687: the mixer state of the tracks is kept by track id, so a track keeps
// its mute, solo, volume and pan when another track is removed, added or moved.
import { describe, it, expect } from 'vitest';
import type { ClipTrack } from '@waveform-playlist/core';
import {
  EMPTY_TRACK_MIXER,
  alignTrackStates,
  mixerForTracks,
  mixerWithAddedTracks,
  patchTrackState,
} from '../utils/trackMixerState';

const track = (id: string, over: Partial<ClipTrack> = {}): ClipTrack =>
  ({
    id,
    name: 'name of ' + id,
    clips: [],
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
    ...over,
  }) as ClipTrack;

describe('mixerForTracks', () => {
  it('takes a new track from its ClipTrack fields', () => {
    const mixer = mixerForTracks(EMPTY_TRACK_MIXER, [track('a', { muted: true, volume: 0.4 })]);
    expect(mixer.get('a')).toEqual({
      name: 'name of a',
      muted: true,
      soloed: false,
      volume: 0.4,
      pan: 0,
    });
  });

  it('keeps the state of the tracks that stay when one is removed', () => {
    let mixer = mixerForTracks(EMPTY_TRACK_MIXER, [track('a'), track('b'), track('c')]);
    mixer = patchTrackState(mixer, 'b', { volume: 0.3 });
    mixer = patchTrackState(mixer, 'c', { muted: true });
    const after = mixerForTracks(mixer, [track('b'), track('c')]);
    expect(after.get('b')?.volume).toBe(0.3);
    expect(after.get('c')?.muted).toBe(true);
    expect(after.has('a')).toBe(false);
    // An unchanged track keeps its very object.
    expect(after.get('b')).toBe(mixer.get('b'));
  });

  it('follows a new name and keeps the rest', () => {
    let mixer = mixerForTracks(EMPTY_TRACK_MIXER, [track('a')]);
    mixer = patchTrackState(mixer, 'a', { pan: -0.5 });
    const after = mixerForTracks(mixer, [track('a', { name: 'renamed' })]);
    expect(after.get('a')).toEqual({
      name: 'renamed',
      muted: false,
      soloed: false,
      volume: 1,
      pan: -0.5,
    });
  });

  it('returns the same map when nothing changed', () => {
    const tracks = [track('a'), track('b')];
    const mixer = mixerForTracks(EMPTY_TRACK_MIXER, tracks);
    expect(mixerForTracks(mixer, [track('a'), track('b')])).toBe(mixer);
    // The order of the tracks is not part of the map.
    expect(mixerForTracks(mixer, [track('b'), track('a')])).toBe(mixer);
  });
});

describe('mixerWithAddedTracks', () => {
  it('adds the new tracks, renames the filled ones and keeps what is there', () => {
    let mixer = mixerForTracks(EMPTY_TRACK_MIXER, [track('a', { name: 'a (loading...)' })]);
    mixer = patchTrackState(mixer, 'a', { soloed: true });
    const after = mixerWithAddedTracks(mixer, [track('b', { volume: 0.2 })], [track('a')]);
    expect(after.get('a')).toEqual({
      name: 'name of a',
      muted: false,
      soloed: true,
      volume: 1,
      pan: 0,
    });
    expect(after.get('b')?.volume).toBe(0.2);
  });

  it('does not replace the state of a track it already holds', () => {
    let mixer = mixerForTracks(EMPTY_TRACK_MIXER, [track('a')]);
    mixer = patchTrackState(mixer, 'a', { muted: true });
    // An updater may run twice (StrictMode).
    const once = mixerWithAddedTracks(mixer, [track('b')], []);
    const twice = mixerWithAddedTracks(once, [track('b')], []);
    expect(twice).toBe(once);
    expect(twice.get('a')?.muted).toBe(true);
  });
});

describe('patchTrackState', () => {
  it('changes one track and leaves the other objects alone', () => {
    const mixer = mixerForTracks(EMPTY_TRACK_MIXER, [track('a'), track('b')]);
    const after = patchTrackState(mixer, 'a', { muted: true });
    expect(after).not.toBe(mixer);
    expect(after.get('a')?.muted).toBe(true);
    expect(after.get('b')).toBe(mixer.get('b'));
  });

  it('is a no-op for a track without state and for an unchanged value', () => {
    const mixer = mixerForTracks(EMPTY_TRACK_MIXER, [track('a')]);
    expect(patchTrackState(mixer, 'missing', { muted: true })).toBe(mixer);
    expect(patchTrackState(mixer, 'a', { muted: false })).toBe(mixer);
  });
});

describe('alignTrackStates', () => {
  it('gives one entry per track, in the order of the tracks', () => {
    let mixer = mixerForTracks(EMPTY_TRACK_MIXER, [track('a'), track('b')]);
    mixer = patchTrackState(mixer, 'b', { volume: 0.1 });
    const aligned = alignTrackStates([track('b'), track('a')], mixer, []);
    expect(aligned.map((state) => state?.volume)).toEqual([0.1, 1]);
  });

  it('leaves a track without state undefined, wherever it is', () => {
    const mixer = mixerForTracks(EMPTY_TRACK_MIXER, [track('a')]);
    const aligned = alignTrackStates([track('new'), track('a')], mixer, []);
    expect(aligned[0]).toBeUndefined();
    expect(aligned[1]).toBe(mixer.get('a'));
  });

  it('returns the previous array when every entry is the same object', () => {
    const mixer = mixerForTracks(EMPTY_TRACK_MIXER, [track('a'), track('b')]);
    const first = alignTrackStates([track('a'), track('b')], mixer, []);
    expect(alignTrackStates([track('a'), track('b')], mixer, first)).toBe(first);
    const changed = patchTrackState(mixer, 'a', { pan: 1 });
    expect(alignTrackStates([track('a'), track('b')], changed, first)).not.toBe(first);
  });
});
