/**
 * The page changes the children of a detached `<daw-track>` (#848, the
 * maintainer's choice a): an element the page removes is gone for good, also
 * from the undo and redo states; a `<daw-clip>` added meanwhile never enters
 * (it warns, and shows `:state(detached)`).
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

const states = new WeakMap<HTMLElement, Set<string>>();
const proto = HTMLElement.prototype as unknown as { attachInternals?: () => unknown };
const original = proto.attachInternals;
beforeAll(async () => {
  proto.attachInternals = function (this: HTMLElement) {
    const set = new Set<string>();
    states.set(this, set);
    return { states: set };
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

/** An editor with one track whose arrival is an undo step, then that step undone. */
async function detachedTrack(): Promise<{ ed: Editor; track: El; c1: El; c2: El }> {
  stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok', '/c.wav': 'ok' });
  const ed: Editor = await mountEditor({
    adapter: makeFakeAdapter().adapter,
    before: (e) => stubPeakPipeline(e),
    html: '<daw-track name="Z" kind="midi"></daw-track>',
  });
  editors.push(ed);
  await settle(ed);
  ed.querySelector('daw-track').volume = 0.5; // an edit first: the next arrival is an undo step
  const track: El = document.createElement('daw-track');
  track.setAttribute('name', 'T');
  track.innerHTML =
    '<daw-clip src="/a.wav"></daw-clip><daw-clip src="/b.wav" start="3"></daw-clip>';
  ed.appendChild(track);
  await settle(ed);
  await tick(3);
  const [c1, c2] = track.querySelectorAll('daw-clip');
  ed.undo();
  await tick(2);
  expect(ed._trackLinkState(track.trackId)).toBe('detached');
  return { ed, track, c1, c2 };
}
const clipIdsOf = (ed: Editor, trackId: string): string[] =>
  ed.arrangement
    .getTracks()
    .find((t: { id: string }) => t.id === trackId)
    ?.clips.map((c: { id: string }) => c.id) ?? [];

describe('<daw-editor>: the children of a detached <daw-track>', () => {
  it('a <daw-clip> removed while its track is detached is not brought back by Redo', async () => {
    const { ed, track, c1, c2 } = await detachedTrack();
    c2.remove();
    await tick(3);
    expect(ed.canRedo).toBe(true);
    ed.redo();
    await settle(ed);
    expect(clipIdsOf(ed, track.trackId)).toEqual([c1.clipId]);
    expect(ed.canRedo).toBe(false);
  });

  it('a <daw-clip> added while its track is detached never enters: it warns and shows detached', async () => {
    const { ed, track, c1, c2 } = await detachedTrack();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const c3: El = document.createElement('daw-clip');
    c3.setAttribute('src', '/c.wav');
    c3.setAttribute('start', '6');
    track.appendChild(c3);
    await tick(3);
    expect(warn.mock.calls.some(([m]) => /is detached .*<daw-clip> added/.test(String(m)))).toBe(
      true
    );
    ed.redo();
    await settle(ed);
    expect(clipIdsOf(ed, track.trackId)).toEqual([c1.clipId, c2.clipId]);
    expect(ed._clipLinkState(track.trackId, c3.clipId)).toBe('detached');
    await tick(2);
    expect(states.get(c3)?.has('detached')).toBe(true);
  });

  it('a <daw-track> removed while detached is not brought back by Redo', async () => {
    const { ed, track } = await detachedTrack();
    track.remove();
    await tick(3);
    ed.redo();
    await settle(ed);
    expect(ed.arrangement.getTracks().some((t: { id: string }) => t.id === track.trackId)).toBe(
      false
    );
  });

  it('a <daw-clip> whose own arrival was undone, then removed, is not brought back by Redo', async () => {
    stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
    const ed: Editor = await mountEditor({
      adapter: makeFakeAdapter().adapter,
      before: (e) => stubPeakPipeline(e),
      html: '<daw-track name="T"><daw-clip src="/a.wav"></daw-clip></daw-track>',
    });
    editors.push(ed);
    await settle(ed);
    const track: El = ed.querySelector('daw-track');
    const c2: El = document.createElement('daw-clip');
    c2.setAttribute('src', '/b.wav');
    c2.setAttribute('start', '3');
    track.appendChild(c2);
    await settle(ed);
    await tick(3);
    ed.undo();
    expect(ed._clipLinkState(track.trackId, c2.clipId)).toBe('detached');
    c2.remove();
    await tick(3);
    ed.redo();
    await settle(ed);
    expect(clipIdsOf(ed, track.trackId)).not.toContain(c2.clipId);
  });

  it('a <daw-clip> removed while the editor was out of the page and its track detached is gone at reconnect', async () => {
    const { ed, track, c1, c2 } = await detachedTrack();
    ed.remove();
    c2.remove();
    document.body.appendChild(ed);
    ed.adapter = makeFakeAdapter().adapter; // a disconnect disposed the old one
    await settle(ed);
    ed.redo();
    await settle(ed);
    expect(clipIdsOf(ed, track.trackId)).toEqual([c1.clipId]);
  });
});
