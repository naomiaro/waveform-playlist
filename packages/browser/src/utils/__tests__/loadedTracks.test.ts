// An arrangement's tracks without their loading clips (#812): what the
// provider publishes as `usePlaylistTimeline().tracks`.
import { describe, it, expect } from 'vitest';
import { createClip, createTrack } from '@waveform-playlist/core';
import type { ArrangementTrack, AudioClip, LoadingClip } from '@waveform-playlist/core';
import { EMPTY_LOADED_TRACKS, loadedTracks } from '../loadedTracks';

const RATE = 48000;

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

function loading(id: string, start = 0): LoadingClip {
  return { id, src: `/${id}.opus`, start, duration: 1 };
}

function track(id: string, clips: ArrangementTrack['clips']): ArrangementTrack {
  return { ...createTrack({ name: id, clips: [] }), id, clips } as ArrangementTrack;
}

describe('loadedTracks', () => {
  it('a track with no loading clip is the same object', () => {
    const a = track('A', [clip('a1', 0), clip('a2', 2 * RATE)]);
    const empty = track('E', []);
    const { tracks } = loadedTracks([a, empty], EMPTY_LOADED_TRACKS);
    expect(tracks[0]).toBe(a);
    expect(tracks[1]).toBe(empty);
  });

  it('a track with one keeps its loaded clips in order', () => {
    const a1 = clip('a1', 0);
    const a3 = clip('a3', 4 * RATE);
    const a = track('A', [a1, loading('L', 2), a3]);
    const { tracks } = loadedTracks([a], EMPTY_LOADED_TRACKS);
    expect(tracks[0]).not.toBe(a);
    expect(tracks[0].id).toBe('A');
    expect(tracks[0].name).toBe('A');
    expect(tracks[0].clips).toEqual([a1, a3]);
    expect(tracks[0].clips[0]).toBe(a1);
    expect(tracks[0].clips[1]).toBe(a3);
    // The arrangement's track is not written to.
    expect(a.clips).toHaveLength(3);
  });

  it('the result array is the same when called again with the same input', () => {
    const input = [track('A', [clip('a1', 0), loading('L')]), track('B', [clip('b1', 0)])];
    const first = loadedTracks(input, EMPTY_LOADED_TRACKS);
    const second = loadedTracks(input, first.cache);
    expect(second.tracks).toBe(first.tracks);
    expect(second.tracks[0]).toBe(first.tracks[0]);
    // A new array with the same track objects gives the same result too.
    const third = loadedTracks([...input], second.cache);
    expect(third.tracks).toBe(first.tracks);
  });

  it('only the changed track is a new object after one arrival', () => {
    const b = track('B', [clip('b1', 0), loading('LB')]);
    const c = track('C', [loading('LC')]);
    const before = [track('A', [clip('a1', 0)]), b, c];
    const first = loadedTracks(before, EMPTY_LOADED_TRACKS);

    // The arrangement replaces the track whose clip arrived, and only it.
    const arrivedB = track('B', [clip('b1', 0), clip('LB', 2 * RATE)]);
    const after = [before[0], arrivedB, c];
    const second = loadedTracks(after, first.cache);

    expect(second.tracks).not.toBe(first.tracks);
    expect(second.tracks[0]).toBe(first.tracks[0]);
    expect(second.tracks[1]).toBe(arrivedB);
    expect(second.tracks[2]).toBe(first.tracks[2]);
    expect(second.tracks[2].clips).toEqual([]);
  });
});
