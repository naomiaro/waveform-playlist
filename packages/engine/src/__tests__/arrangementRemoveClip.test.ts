/**
 * `removeClip` (#848): a clip out of a track, as an undo step, or with
 * `undoable: false` out of every undo and redo state too, so that no undo or
 * redo brings it back (`<daw-editor>`: a `<daw-clip>` the page removes while
 * its track is detached is gone after a Redo).
 */
import { describe, it, expect, vi } from 'vitest';
import { createClip, createTrack } from '@waveform-playlist/core';
import type { ArrangementTrack, AudioClip, ClipSource, LoadingClip } from '@waveform-playlist/core';
import { createArrangement } from '../index';
import type { Arrangement } from '../index';
import type { ArrangementImpl } from '../arrangement/Arrangement';

/** The internal change events (not on the public type). */
const changesOf = (a: Arrangement) => a as unknown as ArrangementImpl;

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
const loading = (id: string, src: ClipSource, start = 0): LoadingClip => ({
  id,
  src,
  start,
  duration: 1,
});
const track = (id: string, clips: ArrangementTrack['clips']): ArrangementTrack => ({
  ...createTrack({ name: id, clips: [] }),
  id,
  clips,
});
const clipIds = (a: Arrangement, trackId: string) =>
  a
    .getTracks()
    .find((t) => t.id === trackId)
    ?.clips.map((c) => c.id);
const statusOf = (a: Arrangement, src: ClipSource) =>
  a.sources.getSnapshot().sources.get(src)?.status;

describe('Arrangement.removeClip', () => {
  it('removes the clip as one undo step; an undo brings it back', () => {
    const a = createArrangement({ tracks: [track('T', [clip('c1', 0), clip('c2', 2 * RATE)])] });
    a.removeClip('T', 'c2');
    expect(clipIds(a, 'T')).toEqual(['c1']);
    expect(a.canUndo).toBe(true);
    a.undo();
    expect(clipIds(a, 'T')).toEqual(['c1', 'c2']);
  });

  it('undoable: false removes it from the current state and no undo brings it back', () => {
    const a = createArrangement({ tracks: [track('T', [clip('c1', 0), clip('c2', 2 * RATE)])] });
    a.addTrack(track('U', []));
    a.removeClip('T', 'c2', { undoable: false });
    expect(clipIds(a, 'T')).toEqual(['c1']);
    a.undo(); // the addition of U
    expect(clipIds(a, 'T')).toEqual(['c1']);
    expect(a.getTracks().map((t) => t.id)).toEqual(['T']);
    expect(a.canUndo).toBe(false);
  });

  it('undoable: false on a track that only a redo state holds: the redo brings the track back without the clip', () => {
    const a = createArrangement({ tracks: [track('A', [])] });
    a.addTrack(track('T', [clip('c1', 0), clip('c2', 2 * RATE)]));
    a.undo();
    const events: string[] = [];
    changesOf(a).onChange((e) => events.push(e.type));
    a.removeClip('T', 'c2', { undoable: false });
    expect(events).toEqual(['history']);
    expect(a.canRedo).toBe(true);
    a.redo();
    expect(clipIds(a, 'T')).toEqual(['c1']);
  });

  it('a step that differed only by the clip goes', () => {
    const a = createArrangement({ tracks: [track('T', [clip('c1', 0)])] });
    a.updateTrack('T', (t) => ({ ...t, clips: [...t.clips, clip('c2', 2 * RATE)] }));
    expect(a.canUndo).toBe(true);
    a.removeClip('T', 'c2', { undoable: false });
    expect(a.canUndo).toBe(false);
    expect(clipIds(a, 'T')).toEqual(['c1']);
  });

  it('announces an update of the track when the current state held the clip', () => {
    const a = createArrangement({ tracks: [track('T', [clip('c1', 0)])] });
    const listener = vi.fn();
    changesOf(a).onChange(listener);
    const version = a.tracksVersion;
    a.removeClip('T', 'c1', { undoable: false });
    expect(listener.mock.calls[0][0]).toMatchObject({ type: 'update', trackId: 'T' });
    expect(a.tracksVersion).toBe(version + 1);
  });

  it('a clip no state holds: nothing changes and nothing is announced', () => {
    const a = createArrangement({ tracks: [track('T', [clip('c1', 0)])] });
    const listener = vi.fn();
    changesOf(a).onChange(listener);
    a.removeClip('T', 'nope');
    a.removeClip('T', 'nope', { undoable: false });
    a.removeClip('nope', 'c1', { undoable: false });
    expect(listener).not.toHaveBeenCalled();
    expect(a.canUndo).toBe(false);
  });

  it("undoable: false drops a loading clip's source once no state holds it", () => {
    const a = createArrangement({ tracks: [track('A', [])] });
    a.addTrack(track('T', [loading('L', 'x.opus')]));
    a.undo();
    expect(statusOf(a, 'x.opus')).toBeDefined();
    a.removeClip('T', 'L', { undoable: false });
    expect(statusOf(a, 'x.opus')).toBeUndefined();
  });

  it('undoable: false leaves no redo step that does nothing: the arrival and the clip added after it', () => {
    const a = createArrangement({ tracks: [track('A', [])] });
    a.addTrack(track('T', [clip('c1', 0)]));
    a.updateTrack('T', (t) => ({ ...t, clips: [...t.clips, clip('c2', 2 * RATE)] }));
    a.undo();
    a.undo();
    a.removeClip('T', 'c2', { undoable: false });
    a.redo();
    expect(clipIds(a, 'T')).toEqual(['c1']);
    expect(a.canRedo).toBe(false);
  });

  it('undoable: false keeps a step that changed something else besides the clip (a rename)', () => {
    const a = createArrangement({ tracks: [track('A', [])] });
    a.addTrack(track('T', [clip('c1', 0)]));
    a.updateTrack('T', (t) => ({ ...t, clips: [...t.clips, clip('c2', 2 * RATE)] }));
    a.updateTrack('T', (t) => ({ ...t, name: 'Renamed' }));
    a.undo();
    a.undo();
    a.undo();
    a.removeClip('T', 'c2', { undoable: false });
    a.redo();
    a.redo();
    expect(a.getTracks().find((t) => t.id === 'T')?.name).toBe('Renamed');
    expect(clipIds(a, 'T')).toEqual(['c1']);
    expect(a.canRedo).toBe(false);
  });

  it('undoable: false leaves no no-op step when the track held the same content at two times (review round 3)', () => {
    const a = createArrangement({ tracks: [track('B', [])] });
    a.updateTrack('B', (t) => ({ ...t, clips: [clip('y', 0)] }));
    a.updateTrack('B', (t) => ({ ...t, clips: [] })); // empty again: another object
    a.updateTrack('B', (t) => ({ ...t, clips: [clip('c', 0)] }));
    a.removeClip('B', 'c', { undoable: false });
    expect(clipIds(a, 'B')).toEqual([]);
    a.undo(); // the first undo changes something: y comes back
    expect(clipIds(a, 'B')).toEqual(['y']);
  });

  it('undoable: false drops a redo step the purge made a no-op', () => {
    const a = createArrangement({ tracks: [track('B', [])] });
    a.updateTrack('B', (t) => ({ ...t, clips: [clip('c', 0)] }));
    a.updateTrack('B', (t) => ({ ...t, clips: [] })); // the clip removed as a step
    a.undo(); // c is back; the removal is a redo
    a.removeClip('B', 'c', { undoable: false });
    expect(clipIds(a, 'B')).toEqual([]);
    expect(a.canUndo).toBe(false);
    expect(a.canRedo).toBe(false);
  });

  it('undoable: false walks the redo steps nearest first', () => {
    const a = createArrangement({ tracks: [track('B', [])] });
    a.updateTrack('B', (t) => ({ ...t, clips: [clip('c', 0)] }));
    a.updateTrack('B', (t) => ({ ...t, clips: [] })); // c removed as a step
    a.updateTrack('B', (t) => ({ ...t, clips: [clip('y', 0)] })); // then y added
    a.undo();
    a.undo(); // c is back; two redo steps: its removal, then y
    a.removeClip('B', 'c', { undoable: false });
    expect(clipIds(a, 'B')).toEqual([]);
    a.redo(); // the first redo changes something: y comes
    expect(clipIds(a, 'B')).toEqual(['y']);
  });
});
