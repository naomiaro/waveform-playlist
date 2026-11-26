/**
 * Findings of the second review round of #848 PR 3 (PR #919): the code
 * reviewer's probes R1, R3, R3b and S, made into tests, and L3.
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { createArrangement, type Arrangement } from '@waveform-playlist/engine';
import { createTrack } from '@waveform-playlist/core';
import { mountEditor, settle, stubFetch, stubPeakPipeline, tick } from './helpers/editor-harness';

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

const isDetached = (el: Element) => states.get(el as HTMLElement)?.has('detached') ?? false;
const where = (a: Arrangement, clipId: string) =>
  a
    .getTracks()
    .filter((t) => t.clips.some((c) => c.id === clipId))
    .map((t) => t.name);
function other(): Arrangement {
  return createArrangement({
    tracks: [{ ...createTrack({ name: 'Other', kind: 'midi', clips: [] }), id: 'other-1' }],
  });
}
async function mount(html: string): Promise<Editor> {
  stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok', '/c.wav': 'ok' });
  const ed: Editor = await mountEditor({ before: (e) => stubPeakPipeline(e), html });
  editors.push(ed);
  await settle(ed);
  return ed;
}
const three = () =>
  mount(
    '<daw-track name="A"><daw-clip src="/a.wav"></daw-clip></daw-track>' +
      '<daw-track name="B"></daw-track><daw-track name="C"></daw-track>'
  );

/** A page track whose arrival is an undo step, with one clip; returns it and the editor. */
async function lateTrack(): Promise<{ ed: Editor; own: Arrangement; late: El; clip: El }> {
  const ed = await three();
  const own: Arrangement = ed.arrangement;
  own.setTrackVolume(own.getTracks()[0].id, 0.3); // an edit first: the arrival is a step
  const late: El = document.createElement('daw-track');
  late.setAttribute('name', 'Late');
  late.innerHTML = '<daw-clip src="/b.wav"></daw-clip>';
  ed.appendChild(late);
  await tick(3);
  await settle(ed);
  return { ed, own, late, clip: late.querySelector('daw-clip') };
}

describe('review round 2 of #848 PR 3', () => {
  it('M1: after an Undo of a move, a move on and back into the earlier track moves the clip', async () => {
    const ed = await three();
    const own: Arrangement = ed.arrangement;
    const [A, B, C] = ed.querySelectorAll('daw-track');
    const clip: El = A.querySelector('daw-clip');
    B.appendChild(clip);
    await tick(3);
    own.undo();
    await tick(2);
    C.appendChild(clip);
    await tick(3);
    expect(where(own, clip.clipId)).toEqual(['C']);
    B.appendChild(clip);
    await tick(3);
    expect(where(own, clip.clipId)).toEqual(['B']);
  });

  it('M2: a detached track removed while a handed-in arrangement is set does not come back on Redo', async () => {
    const { ed, own, late } = await lateTrack();
    own.undo(); // the arrival of Late
    ed.arrangement = other();
    late.remove();
    await tick(3);
    ed.arrangement = null;
    await tick(3);
    while (own.canRedo) own.redo();
    expect(own.getTracks().map((t) => t.name)).not.toContain('Late');
  });

  it('M2: a clip of a detached track removed while handed in does not come back on Redo', async () => {
    const { ed, own, clip } = await lateTrack();
    own.undo();
    ed.arrangement = other();
    clip.remove();
    await tick(3);
    ed.arrangement = null;
    await tick(3);
    while (own.canRedo) own.redo();
    expect(where(own, clip.clipId)).toEqual([]);
  });

  it('L2: an Undo made while the editor is out of the page shows as detached once it is back', async () => {
    const ed = await mount('<daw-track name="A" kind="midi"></daw-track>');
    const own: Arrangement = ed.arrangement;
    own.setTrackVolume(own.getTracks()[0].id, 0.2);
    const late: El = document.createElement('daw-track');
    late.setAttribute('name', 'Late');
    late.setAttribute('kind', 'midi');
    ed.appendChild(late);
    await tick(3);
    const parent = ed.parentElement;
    ed.remove();
    own.undo(); // Late's arrival, while out of the page
    parent.appendChild(ed);
    await tick(4);
    expect(isDetached(late)).toBe(true);
  });

  it('L3: editor.tracks lists a clip whose element sits in another track as the element declares it', async () => {
    const ed = await mount(
      '<daw-track name="A"><daw-clip src="/a.wav" peaks-src="/a.dat"></daw-clip></daw-track>' +
        '<daw-track name="B"></daw-track>'
    );
    const [A, B] = ed.querySelectorAll('daw-track');
    const clip: El = A.querySelector('daw-clip');
    B.appendChild(clip);
    await tick(3);
    ed.undo(); // the clip is in A again; its element stays in B
    await tick(3);
    const listed = ed.tracks
      .find((t: { trackId: string }) => t.trackId === A.trackId)
      .clips.find((c: { clipId?: string }) => c.clipId === clip.clipId);
    expect(listed).toMatchObject({ kind: 'dom', peaksSrc: '/a.dat' });
  });

  it('a clip element no track holds, moved on and back: each move reaches the editor', async () => {
    const ed = await three();
    const own: Arrangement = ed.arrangement;
    const [A, B, C] = ed.querySelectorAll('daw-track');
    const clip: El = A.querySelector('daw-clip');
    B.appendChild(clip);
    await tick(3);
    // The app takes the clip out: the element in B holds nothing now.
    own.updateTrack(B.trackId, (t) => ({ ...t, clips: [] }));
    C.appendChild(clip); // a new arrival in C
    await tick(3);
    expect(where(own, clip.clipId)).toEqual(['C']);
    B.appendChild(clip); // and back: a move from C to B
    await tick(3);
    expect(where(own, clip.clipId)).toEqual(['B']);
  });
});
