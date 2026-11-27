import { describe, it, expect } from 'vitest';
import { createArrangement } from '@waveform-playlist/engine';
import type { AudioClip, ArrangementTrack, LoadingClip } from '@waveform-playlist/core';
import { clipSeconds, loadedTrack, mixOf } from '../interactions/arrangement-view';

const loaded = (id: string, startSample: number, durationSamples: number): AudioClip => ({
  id,
  startSample,
  durationSamples,
  offsetSamples: 24000,
  sampleRate: 48000,
  sourceDurationSamples: 96000,
  gain: 0.5,
  name: id,
});

const loading = (id: string): LoadingClip => ({
  id,
  src: '/x.wav',
  start: 1,
  duration: 0.5,
  offset: 0.5,
  gain: 0.5,
  name: id,
});

function track(clips: (AudioClip | LoadingClip)[]): ArrangementTrack {
  return {
    id: 't1',
    kind: 'audio',
    name: 'T',
    clips,
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  };
}

const MIX = { volume: 0.25, pan: -0.5, muted: false, soloed: true, panLaw: 'auto' as const };

describe('arrangement-view (#848)', () => {
  it('loadedTrack leaves out loading clips and carries the mix', () => {
    const t = track([loaded('a', 0, 48000), loading('b')]);
    const view = loadedTrack(t, MIX, false);
    expect(view.clips.map((c) => c.id)).toEqual(['a']);
    expect(view).toMatchObject({ id: 't1', volume: 0.25, pan: -0.5, muted: false, soloed: true });
  });

  it('loadedTrack returns the same object for the same track and mix', () => {
    const t = track([loaded('a', 0, 48000)]);
    expect(loadedTrack(t, { ...MIX }, false)).toBe(loadedTrack(t, { ...MIX }, false));
    expect(loadedTrack(t, { ...MIX, volume: 1 }, false)).not.toBe(loadedTrack(t, MIX, false));
  });

  it('loadedTrack shows a recording track muted', () => {
    const t = track([loaded('a', 0, 48000)]);
    expect(loadedTrack(t, MIX, true).muted).toBe(true);
  });

  it('mixOf is the stored mix, muted while the track is recording', () => {
    const arrangement = createArrangement({ tracks: [track([loaded('a', 0, 48000)])] });
    arrangement.setTrackVolume('t1', 0.25);
    expect(mixOf(arrangement, 't1')).toEqual({
      volume: 0.25,
      pan: 0,
      muted: false,
      soloed: false,
      panLaw: 'auto',
    });
    arrangement.setTrackRecording('t1', true);
    expect(mixOf(arrangement, 't1')?.muted).toBe(true);
    expect(mixOf(arrangement, 'nope')).toBeNull();
  });

  it('clipSeconds gives the same seconds for a loading clip and the clip it loads into', () => {
    expect(clipSeconds(loading('b'), 48000)).toEqual({ start: 1, duration: 0.5, offset: 0.5 });
    expect(clipSeconds(loaded('a', 48000, 24000), 48000)).toEqual({
      start: 1,
      duration: 0.5,
      offset: 0.5,
    });
  });

  it('clipSeconds of a loading clip with no times is 0, 0, 0 (its length is not known yet)', () => {
    expect(clipSeconds({ id: 'c', src: '/c.wav' }, 48000)).toEqual({
      start: 0,
      duration: 0,
      offset: 0,
    });
  });
});
