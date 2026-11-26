/**
 * A `<daw-clip>` the page moves into another `<daw-track>` moves its clip
 * there, one undo step (#848, the maintainer's choice a; on `dev` the clip
 * was left in both tracks). A clip moved out of the editor goes from its
 * track. The elements' `connectedMoveCallback` announces the new place.
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import {
  makeFakeAdapter,
  mountEditor,
  settle,
  stubFetch,
  stubPeakPipeline,
  tick,
} from './helpers/editor-harness';

const proto = HTMLElement.prototype as unknown as { attachInternals?: () => unknown };
const original = proto.attachInternals;
beforeAll(async () => {
  proto.attachInternals = function () {
    return { states: new Set<string>() };
  };
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
});
afterAll(() => {
  proto.attachInternals = original;
});

const editors: HTMLElement[] = [];
afterEach(() => {
  for (const e of editors.splice(0)) e.remove();
  vi.restoreAllMocks();
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Editor = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type El = any;

async function twoTracks(second = '<daw-track name="B"></daw-track>'): Promise<{
  ed: Editor;
  a: El;
  b: El;
  clip: El;
}> {
  stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
  const ed: Editor = await mountEditor({
    adapter: makeFakeAdapter().adapter,
    before: (e) => stubPeakPipeline(e),
    html:
      '<daw-track name="A"><daw-clip src="/a.wav" start="2"></daw-clip>' +
      '<daw-clip src="/b.wav" start="5"></daw-clip></daw-track>' +
      second,
  });
  editors.push(ed);
  await settle(ed);
  await tick(3);
  const [a, b] = ed.querySelectorAll('daw-track');
  const clip = a.querySelector('daw-clip');
  return { ed, a, b, clip };
}
const clipsOf = (ed: Editor, trackId: string) =>
  ed.arrangement.getTracks().find((t: { id: string }) => t.id === trackId)?.clips ?? [];
const ids = (ed: Editor, trackId: string) => clipsOf(ed, trackId).map((c: { id: string }) => c.id);

describe('<daw-editor>: a <daw-clip> moved to another <daw-track>', () => {
  it('moves the clip: out of the old track, into the new one, as it was', async () => {
    const { ed, a, b, clip } = await twoTracks();
    const before = clipsOf(ed, a.trackId).find((c: { id: string }) => c.id === clip.clipId);
    b.appendChild(clip);
    await tick(3);
    expect(ids(ed, a.trackId)).not.toContain(clip.clipId);
    expect(ids(ed, b.trackId)).toEqual([clip.clipId]);
    const after = clipsOf(ed, b.trackId)[0];
    expect(after.startSample).toBe(before.startSample);
    expect(after.durationSamples).toBe(before.durationSamples);
    expect(ed._clipLinkState(b.trackId, clip.clipId)).toBe('live');
  });

  it('is one undo step: an Undo puts the clip back in the old track, a Redo moves it again', async () => {
    const { ed, a, b, clip } = await twoTracks();
    b.appendChild(clip);
    await tick(3);
    ed.undo();
    expect(ids(ed, a.trackId)).toContain(clip.clipId);
    expect(ids(ed, b.trackId)).toEqual([]);
    ed.redo();
    expect(ids(ed, a.trackId)).not.toContain(clip.clipId);
    expect(ids(ed, b.trackId)).toEqual([clip.clipId]);
  });

  it('a clip of the wrong kind is refused: nothing changes, no undo step, the element stays linked to its clip', async () => {
    const { ed, a, b, clip } = await twoTracks('<daw-track name="M" kind="midi"></daw-track>');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errors: unknown[] = [];
    ed.addEventListener('daw-clip-error', (e: CustomEvent) => errors.push(e.detail));
    const canUndo = ed.canUndo;
    const before = ed.arrangement.getTracks();
    b.appendChild(clip);
    await tick(3);
    expect(clip.parentElement).toBe(b); // the editor moves no element
    expect(ed.arrangement.getTracks()).toBe(before);
    expect(ed.canUndo).toBe(canUndo);
    expect(ed._clipLinkState(b.trackId, clip.clipId)).toBe('live');
    expect(clip.start).toBe(2); // the clip in A, read by id
    expect(errors).toHaveLength(1);
    expect(warn.mock.calls.some(([m]) => /stays in its track/.test(String(m)))).toBe(true);
    clip.connectedMoveCallback(); // announced again: not refused a second time
    await tick(3);
    expect(errors).toHaveLength(1);
    expect(ids(ed, a.trackId)).toContain(clip.clipId);
  });

  it('a <daw-clip> moved out of the editor leaves its track', async () => {
    const { ed, a, clip } = await twoTracks();
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    outside.appendChild(clip);
    await tick(3);
    expect(ids(ed, a.trackId)).not.toContain(clip.clipId);
    outside.remove();
  });

  it('connectedMoveCallback announces the element again, and the editor enters nothing twice', async () => {
    const { ed, a, b, clip } = await twoTracks();
    const seen: string[] = [];
    ed.addEventListener('daw-track-connected', () => seen.push('track'));
    ed.addEventListener('daw-clip-connected', () => seen.push('clip'));
    const tracks = ed.arrangement.getTracks().length;
    const canUndo = ed.canUndo;
    a.connectedMoveCallback();
    clip.connectedMoveCallback();
    await tick(3);
    expect(seen.sort()).toEqual(['clip', 'track']);
    expect(ed.arrangement.getTracks()).toHaveLength(tracks);
    expect(ids(ed, a.trackId)).toContain(clip.clipId);
    expect(ed.canUndo).toBe(canUndo);
    expect(b.isConnected).toBe(true);
  });

  it('after a move, the element announced again in its new track is not added twice', async () => {
    const { ed, b, clip } = await twoTracks();
    b.appendChild(clip);
    await tick(3);
    const errors: unknown[] = [];
    ed.addEventListener('daw-clip-error', (e: CustomEvent) => errors.push(e.detail));
    clip.connectedMoveCallback(); // a moveBefore() inside the same track
    await tick(3);
    expect(ids(ed, b.trackId)).toEqual([clip.clipId]);
    expect(errors).toEqual([]);
  });

  it('after a move, a reconnect of the editor leaves the history alone: an Undo puts the clip back', async () => {
    const { ed, a, b, clip } = await twoTracks();
    b.appendChild(clip);
    await tick(3);
    ed.remove();
    document.body.appendChild(ed);
    ed.adapter = makeFakeAdapter().adapter; // a disconnect disposed the old one
    await settle(ed);
    expect(ids(ed, b.trackId)).toEqual([clip.clipId]);
    ed.undo();
    expect(ids(ed, a.trackId)).toContain(clip.clipId);
  });

  it('after an Undo of a move the element stays where the page put it, linked to its clip by id', async () => {
    const { ed, a, b, clip } = await twoTracks();
    b.appendChild(clip);
    await tick(3);
    ed.undo();
    await tick(3);
    expect(clip.parentElement).toBe(b);
    expect(ids(ed, a.trackId)).toContain(clip.clipId);
    expect(ed._clipLinkState(b.trackId, clip.clipId)).toBe('live');
    expect(clip.start).toBe(2);
    ed.redo(); // the move again: the element is where its clip is
    expect(ids(ed, b.trackId)).toEqual([clip.clipId]);
    ed.undo();
    clip.start = 3; // a request to the clip, in track A (a new step: the redo goes)
    const inA = clipsOf(ed, a.trackId).find((c: { id: string }) => c.id === clip.clipId);
    expect(inA.startSample).toBe(3 * ed.effectiveSampleRate);
    clip.remove(); // its removal takes the clip from A, the track that holds it
    await tick(3);
    expect(ids(ed, a.trackId)).not.toContain(clip.clipId);
    expect(ids(ed, b.trackId)).not.toContain(clip.clipId);
  });

  it('after an Undo of a move the page can move the element back: it is linked again, nothing is added', async () => {
    const { ed, a, b, clip } = await twoTracks();
    b.appendChild(clip);
    await tick(3);
    ed.undo();
    await tick(3);
    const errors: unknown[] = [];
    ed.addEventListener('daw-clip-error', (e: CustomEvent) => errors.push(e.detail));
    const canUndo = ed.canUndo;
    a.appendChild(clip);
    await tick(3);
    expect(errors).toEqual([]);
    expect(ids(ed, a.trackId).filter((id: string) => id === clip.clipId)).toHaveLength(1);
    expect(ed._clipLinkState(a.trackId, clip.clipId)).toBe('live');
    expect(ed.canUndo).toBe(canUndo);
  });

  it('an element the page did not move is not moved: a clip the app moves through the arrangement', async () => {
    const { ed, a, b, clip } = await twoTracks();
    const held = clipsOf(ed, a.trackId).find((c: { id: string }) => c.id === clip.clipId);
    ed.arrangement.beginTransaction();
    ed.arrangement.updateTrack(a.trackId, (t: { clips: { id: string }[] }) => ({
      ...t,
      clips: t.clips.filter((c) => c.id !== clip.clipId),
    }));
    ed.arrangement.updateTrack(b.trackId, (t: { clips: unknown[] }) => ({
      ...t,
      clips: [...t.clips, held],
    }));
    ed.arrangement.commitTransaction();
    await tick(3);
    ed.undo();
    ed.redo();
    await tick(3);
    expect(clip.parentElement).toBe(a);
  });
});
