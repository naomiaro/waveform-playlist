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

  // The engine keeps its own track order and mixer state is stored by
  // position, so a change that also moves an existing track is a rebuild.
  it('returns null when the existing tracks changed order', () => {
    const track1 = makeTrack('1');
    const track2 = makeTrack('2');
    const placeholder = makeTrack('3');
    const filledTrack = { ...placeholder, clips: [clip('a')] } as ClipTrack;

    expect(incrementalTrackChange([track1, track2], [track2, track1, makeTrack('4')])).toBeNull();
    expect(incrementalTrackChange([track1, placeholder], [filledTrack, track1])).toBeNull();
  });

  // The engine appends an added track and its mixer state is appended too.
  it('returns null when a new track is inserted before an existing one', () => {
    const track1 = makeTrack('1');
    const track2 = makeTrack('2');

    expect(incrementalTrackChange([track1, track2], [track1, makeTrack('3'), track2])).toBeNull();
    expect(incrementalTrackChange([track1], [makeTrack('3'), track1])).toBeNull();
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

  // A clip whose source finished loading arrives on a track that already has
  // clips: the previous clips are still there, the same objects, in order.
  describe('a track that gained a clip', () => {
    const a = clip('a');
    const b = clip('b');
    const x = clip('x');

    it('detects a clip appended after the existing one', () => {
      const prev = makeTrack('1', [a]);
      const next = { ...prev, clips: [a, x] } as ClipTrack;

      expect(incrementalTrackChange([prev], [next])).toEqual({ added: [], filled: [next] });
    });

    it('detects a new clip before or between the existing ones', () => {
      const prev = makeTrack('1', [a, b]);
      const between = { ...prev, clips: [a, x, b] } as ClipTrack;
      const before = { ...prev, clips: [x, a, b] } as ClipTrack;

      expect(incrementalTrackChange([prev], [between])?.filled).toEqual([between]);
      expect(incrementalTrackChange([prev], [before])?.filled).toEqual([before]);
    });

    it('returns null when the previous clip was replaced by another object with its id', () => {
      const prev = makeTrack('1', [a]);
      const next = { ...prev, clips: [{ ...a }, x] } as ClipTrack;

      expect(incrementalTrackChange([prev], [next])).toBeNull();
    });

    it('returns null when a previous clip is gone', () => {
      const prev = makeTrack('1', [a]);
      const next = { ...prev, clips: [x] } as ClipTrack;

      expect(incrementalTrackChange([prev], [next])).toBeNull();
    });

    it('returns null when the previous clips changed order', () => {
      const prev = makeTrack('1', [a, b]);
      const next = { ...prev, clips: [b, a, x] } as ClipTrack;

      expect(incrementalTrackChange([prev], [next])).toBeNull();
    });

    it('returns null for a new track object with the same clips (nothing gained)', () => {
      const prev = makeTrack('1', [a]);
      const next = { ...prev, clips: [a] } as ClipTrack;

      expect(incrementalTrackChange([prev], [next])).toBeNull();
    });

    it('returns null when anything but the clips differs', () => {
      const prev = makeTrack('1', [a]);
      const clips = [a, x];

      for (const change of [
        { name: 'Renamed' },
        { muted: true },
        { volume: 0.5 },
        { color: 'red' },
      ]) {
        const next = { ...prev, ...change, clips } as ClipTrack;
        expect(incrementalTrackChange([prev], [next])).toBeNull();
      }
    });

    it('returns null when a field present before is gone', () => {
      const prev = { ...makeTrack('1', [a]), color: 'red' } as ClipTrack;
      const { color: _color, ...rest } = prev as ClipTrack & { color: string };
      const next = { ...rest, clips: [a, x] } as ClipTrack;

      expect(incrementalTrackChange([prev], [next])).toBeNull();
    });

    it('keeps the rules: a gained clip and an unrelated rebuild is still a rebuild', () => {
      const prev1 = makeTrack('1', [a]);
      const prev2 = makeTrack('2', [b]);
      const next1 = { ...prev1, clips: [a, x] } as ClipTrack;

      expect(incrementalTrackChange([prev1, prev2], [next1, { ...prev2 }])).toBeNull();
      expect(incrementalTrackChange([prev1, prev2], [prev2, next1])).toBeNull();
    });

    it('handles a track filled the old way, one the new way and one added', () => {
      const placeholder = makeTrack('1');
      const filledOld = { ...placeholder, clips: [clip('p')] } as ClipTrack;
      const prev2 = makeTrack('2', [a]);
      const filledNew = { ...prev2, clips: [a, x] } as ClipTrack;
      const unchanged = makeTrack('3', [b]);
      const added = makeTrack('4');

      expect(
        incrementalTrackChange(
          [placeholder, prev2, unchanged],
          [filledOld, filledNew, unchanged, added]
        )
      ).toEqual({ added: [added], filled: [filledOld, filledNew] });
    });
  });
});
