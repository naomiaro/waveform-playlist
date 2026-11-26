/**
 * `<daw-track>` and `<daw-clip>` are linked to their track and clip by id
 * (#848 PR 3, P8-P12): attributes are the declaration, properties read the
 * arrangement while it holds the id, and an element whose id left it is
 * detached (`:state(detached)`).
 *
 * happy-dom 21 has no `attachInternals`: it is stubbed with a set of states,
 * which is what the elements write to. The real `:state()` selector is
 * checked in Chromium (e2e).
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
import type { Arrangement } from '@waveform-playlist/engine';

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

type TrackEl = HTMLElement & {
  trackId: string;
  volume: number;
  muted: boolean;
  name: string;
  index: number;
  updateComplete: Promise<boolean>;
};
type ClipEl = HTMLElement & { clipId: string; start: number; gain: number };
type Editor = HTMLElement & { _arrangement: Arrangement; tracks: { trackId: string }[] };

const editors: HTMLElement[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.remove();
  vi.restoreAllMocks();
});

const isDetached = (el: HTMLElement) => states.get(el)?.has('detached') ?? false;

async function setup(html: string): Promise<Editor> {
  stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
  const mounted = await mountEditor({
    adapter: makeFakeAdapter().adapter,
    before: (e) => stubPeakPipeline(e),
    html,
  });
  editors.push(mounted);
  await settle(mounted);
  return mounted as unknown as Editor;
}

const A =
  '<daw-track name="A" volume="0.8"><daw-clip src="/a.wav" start="0" duration="1"></daw-clip></daw-track>';
const B =
  '<daw-track name="B"><daw-clip src="/b.wav" start="0" duration="1"></daw-clip></daw-track>';

const firstTrack = (editor: Editor) => editor.querySelector('daw-track') as TrackEl;
const firstClip = (editor: Editor) => editor.querySelector('daw-clip') as ClipEl;
const startOf = (editor: Editor, clipId: string) => {
  for (const t of editor._arrangement.getTracks()) {
    const c = t.clips.find((x) => x.id === clipId);
    if (c) return 'startSample' in c ? c.startSample / 48000 : (c.start ?? 0);
  }
  return undefined;
};

describe('<daw-track> / <daw-clip> linked to the arrangement (#848)', () => {
  it('trackEl.volume reads the arrangement and a set is one undo step; the attribute is untouched', async () => {
    const editor = await setup(A);
    const el = firstTrack(editor);
    expect(el.volume).toBe(0.8);
    editor._arrangement.setTrackVolume(el.trackId, 0.3);
    expect(el.volume).toBe(0.3);
    el.volume = 0.5;
    expect(el.volume).toBe(0.5);
    expect(el.getAttribute('volume')).toBe('0.8');
    editor._arrangement.undo();
    expect(el.volume).toBe(0.3);
  });

  it('clipEl.start after an arrangement.moveClip is the new position', async () => {
    const editor = await setup(A);
    const el = firstTrack(editor);
    const clip = firstClip(editor);
    editor._arrangement.moveClip(el.trackId, clip.clipId, 48000);
    expect(clip.start).toBe(1);
    expect(clip.getAttribute('start')).toBe('0');
  });

  it('a property set before the track enters is the value it enters with', async () => {
    const editor = await setup(A);
    const late = document.createElement('daw-track') as TrackEl;
    late.setAttribute('name', 'Late');
    late.volume = 0.25;
    editor.appendChild(late);
    expect(late.volume).toBe(0.25);
    await tick(3);
    expect(editor._arrangement.getMixer().get(late.trackId)?.volume).toBe(0.25);
    expect(late.volume).toBe(0.25);
    expect(late.hasAttribute('volume')).toBe(false);
  });

  it("undo of a track's arrival detaches its element; redo makes it live again", async () => {
    const editor = await setup(A);
    // An edit first: a page track that enters into an empty history is not
    // an undo step (the page-load rule), this one must be.
    editor._arrangement.setTrackVolume(firstTrack(editor).trackId, 0.7);
    const late = document.createElement('daw-track') as TrackEl;
    late.setAttribute('name', 'Late');
    late.setAttribute('volume', '0.4');
    editor.appendChild(late);
    await tick(3);
    editor._arrangement.setTrackVolume(late.trackId, 0.9);
    editor._arrangement.undo(); // the volume
    editor._arrangement.undo(); // the arrival
    expect(isDetached(late)).toBe(true);
    expect(isDetached(firstTrack(editor))).toBe(false);
    expect(editor.tracks.map((t) => t.trackId)).not.toContain(late.trackId);
    expect(late.volume).toBe(0.4); // its attribute
    expect(late.index).toBe(-1);
    editor._arrangement.redo();
    expect(isDetached(late)).toBe(false);
    expect(late.index).toBe(1);
  });

  it('an attribute change on a live element is one undo step; the value the arrangement holds already is none', async () => {
    const editor = await setup(A);
    const el = firstTrack(editor);
    el.setAttribute('volume', '0.6');
    expect(editor._arrangement.getMixer().get(el.trackId)?.volume).toBe(0.6);
    expect(editor._arrangement.canUndo).toBe(true);
    editor._arrangement.undo();
    expect(editor._arrangement.canUndo).toBe(false);
    el.setAttribute('volume', '0.8'); // what the arrangement holds after the undo
    expect(editor._arrangement.canUndo).toBe(false);
  });

  it('an attribute change on a detached element warns once and changes nothing', async () => {
    const editor = await setup(A + B);
    const b = editor.querySelectorAll('daw-track')[1] as TrackEl;
    editor._arrangement.removeTrack(b.trackId);
    expect(isDetached(b)).toBe(true);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const version = editor._arrangement.mixerVersion;
    b.setAttribute('volume', '0.1');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/<daw-track name="B">.*not in the arrangement/);
    expect(editor._arrangement.mixerVersion).toBe(version);
    expect(b.volume).toBe(0.1); // the declaration, read back
  });

  it('trackEl.index follows an arrangement.reorderTrack', async () => {
    const editor = await setup(A + B);
    const [a, b] = [...editor.querySelectorAll('daw-track')] as TrackEl[];
    expect([a.index, b.index]).toEqual([0, 1]);
    editor._arrangement.reorderTrack(b.trackId, 0);
    expect([a.index, b.index]).toEqual([1, 0]);
  });

  it('a start set on a clip still loading moves the placeholder, and the clip loads at the new start', async () => {
    stubFetch({ '/slow.wav': 'ok' });
    const fake = makeFakeAdapter();
    const held = fake.holdDecode('/slow.wav');
    const mounted = await mountEditor({
      adapter: fake.adapter,
      before: (e) => stubPeakPipeline(e),
      html: '<daw-track name="S"><daw-clip src="/slow.wav" start="0" duration="1"></daw-clip></daw-track>',
    });
    editors.push(mounted);
    const editor = mounted as unknown as Editor;
    await tick(3);
    const clip = firstClip(editor);
    clip.start = 2;
    expect(clip.start).toBe(2);
    expect(startOf(editor, clip.clipId)).toBe(2);
    held.resolve();
    await settle(mounted);
    expect(startOf(editor, clip.clipId)).toBe(2);
    expect(clip.start).toBe(2);
  });

  it('trackEl.muted is the stored mute during a take', async () => {
    const editor = await setup(A);
    const el = firstTrack(editor);
    editor._arrangement.setTrackRecording(el.trackId, true);
    expect(el.muted).toBe(false);
  });
});
