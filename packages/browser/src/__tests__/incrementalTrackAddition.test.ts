import { describe, it, expect } from 'vitest';
import type { ClipTrack } from '@waveform-playlist/core';
import { incrementalTrackChange } from '../utils/incrementalTrackChange';

/**
 * When tracks are appended (file drop, new empty track) or an empty track gets
 * its clips (a `useDynamicTracks` placeholder whose audio finished decoding),
 * the provider applies the change to the running engine instead of rebuilding
 * it. `incrementalTrackChange` decides which case a `tracks` change is.
 */

function makeTrack(id: string, clips: unknown[] = []): ClipTrack {
  return {
    id,
    name: `Track ${id}`,
    clips,
    volume: 1,
    muted: false,
    soloed: false,
    pan: 0,
  } as unknown as ClipTrack;
}

const clip = (id: string) => ({ id });

describe('incrementalTrackChange', () => {
  it('detects appending a single new track', () => {
    const track1 = makeTrack('1');
    const track2 = makeTrack('2');

    expect(incrementalTrackChange([track1], [track1, track2])).toEqual({
      added: [track2],
      filled: [],
    });
  });

  it('detects appending multiple new tracks', () => {
    const track1 = makeTrack('1');
    const track2 = makeTrack('2');
    const track3 = makeTrack('3');

    expect(incrementalTrackChange([track1], [track1, track2, track3])?.added).toEqual([
      track2,
      track3,
    ]);
  });

  it('detects the first track on an empty timeline', () => {
    const track1 = makeTrack('1');

    expect(incrementalTrackChange([], [track1])?.added).toEqual([track1]);
  });

  it('returns null when nothing was added or filled', () => {
    const track1 = makeTrack('1');

    expect(incrementalTrackChange([track1], [track1])).toBeNull();
    expect(incrementalTrackChange([], [])).toBeNull();
  });

  it('returns null when a track was removed', () => {
    const track1 = makeTrack('1');
    const track2 = makeTrack('2');

    expect(incrementalTrackChange([track1, track2], [track1])).toBeNull();
    // Removed and replaced by another: same count, still a rebuild.
    expect(incrementalTrackChange([track1, track2], [track1, makeTrack('3')])).toBeNull();
  });

  it('returns null when a track that has clips was replaced', () => {
    const track1 = makeTrack('1', [clip('a')]);
    const moved = { ...track1, clips: [clip('a'), clip('b')] } as ClipTrack;

    expect(incrementalTrackChange([track1], [moved])).toBeNull();
    expect(incrementalTrackChange([track1], [moved, makeTrack('2')])).toBeNull();
  });

  it('returns null when an empty track was replaced by another empty one (a rename)', () => {
    const track1 = makeTrack('1');
    const renamed = { ...track1, name: 'Modified' } as ClipTrack;

    expect(incrementalTrackChange([track1], [renamed])).toBeNull();
    expect(incrementalTrackChange([track1], [renamed, makeTrack('2')])).toBeNull();
  });

  it('returns null when one of many existing tracks with clips changes', () => {
    const track1 = makeTrack('1', [clip('a')]);
    const track2 = makeTrack('2', [clip('b')]);
    const track3 = makeTrack('3', [clip('c')]);

    expect(
      incrementalTrackChange(
        [track1, track2, track3],
        [track1, { ...track2 }, track3, makeTrack('4')]
      )
    ).toBeNull();
  });

  it('accepts reordered existing tracks (still the same objects)', () => {
    const track1 = makeTrack('1');
    const track2 = makeTrack('2');
    const track3 = makeTrack('3');

    expect(incrementalTrackChange([track1, track2], [track2, track1, track3])?.added).toEqual([
      track3,
    ]);
  });

  // useDynamicTracks: a placeholder with no clips is replaced by the same
  // track with its decoded clip. The array keeps its length.
  it('detects an empty track that got its clips', () => {
    const loaded = makeTrack('1', [clip('a')]);
    const placeholder = makeTrack('2');
    const filledTrack = { ...placeholder, name: 'Guitar', clips: [clip('b')] } as ClipTrack;

    expect(incrementalTrackChange([loaded, placeholder], [loaded, filledTrack])).toEqual({
      added: [],
      filled: [filledTrack],
    });
  });

  it('detects a fill and an append in one change', () => {
    const placeholder = makeTrack('1');
    const filledTrack = { ...placeholder, clips: [clip('a')] } as ClipTrack;
    const track2 = makeTrack('2');

    expect(incrementalTrackChange([placeholder], [filledTrack, track2])).toEqual({
      added: [track2],
      filled: [filledTrack],
    });
  });
});
