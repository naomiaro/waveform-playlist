/**
 * A clip drag shows its change in the view and calls the arrangement once, on
 * release (#848 PR 3, P1): nothing in the arrangement changes while the
 * pointer moves, so a change during a drag always came from outside.
 *
 * The drag goes through the editor's real `PointerHandler` and
 * `ClipPointerHandler`; pointer capture of a fabricated pointer only warns.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import {
  makeFakeAdapter,
  mountEditor,
  settle,
  stubFetch,
  stubPeakPipeline,
  tick,
} from './helpers/editor-harness';
import type { Arrangement } from '@waveform-playlist/engine';

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
});

type Editor = HTMLElement & {
  _pointer: { onPointerDown(e: PointerEvent): void };
  _clipPointer: { isDragging: boolean };
  _arrangement: Arrangement;
  updateComplete: Promise<boolean>;
};

const editors: HTMLElement[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.remove();
  vi.restoreAllMocks();
});

const SR = 48000;
const SPP = 1024;

/** One track, clip A at 0-1 s and clip B at 2-3 s, loaded. */
async function setup(): Promise<{ editor: Editor; a: string; b: string }> {
  stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
  const fake = makeFakeAdapter({ sampleRate: SR });
  const mounted = await mountEditor({
    adapter: fake.adapter,
    before: (e) => {
      stubPeakPipeline(e);
      e.setAttribute('interactive-clips', '');
      e.setAttribute('clip-headers', '');
      e.setAttribute('samples-per-pixel', String(SPP));
    },
    html:
      '<daw-track name="T"><daw-clip src="/a.wav" start="0" duration="1"></daw-clip>' +
      '<daw-clip src="/b.wav" start="2" duration="1"></daw-clip></daw-track>',
  });
  const editor = mounted as unknown as Editor;
  editors.push(editor);
  await settle(mounted);
  await editor.updateComplete;
  const [a, b] = [...editor.querySelectorAll('daw-clip')].map(
    (c) => (c as unknown as { clipId: string }).clipId
  );
  return { editor, a, b };
}

function startOf(editor: Editor, clipId: string): number {
  for (const t of editor._arrangement.getTracks()) {
    const clip = t.clips.find((c) => c.id === clipId);
    if (clip && 'startSample' in clip) return clip.startSample;
  }
  throw new Error('no loaded clip ' + clipId);
}

function header(editor: Editor, clipId: string): HTMLElement {
  const el = editor.shadowRoot!.querySelector(
    '.clip-header[data-clip-id="' + clipId + '"]'
  ) as HTMLElement | null;
  if (!el) throw new Error('no header for ' + clipId);
  return el;
}

function container(editor: Editor, clipId: string): HTMLElement {
  return header(editor, clipId).closest('.clip-container') as HTMLElement;
}

const pe = (type: string, clientX: number) =>
  new PointerEvent(type, { clientX, pointerId: 1, bubbles: true });

function timeline(editor: Editor): HTMLElement {
  return editor.shadowRoot!.querySelector('.timeline') as HTMLElement;
}

/** Press the header of `clipId` at x=100 and move the pointer by each delta in turn. */
function drag(editor: Editor, clipId: string, deltas: number[]): void {
  const down = pe('pointerdown', 100);
  const target = header(editor, clipId);
  Object.defineProperty(down, 'composedPath', { value: () => [target] });
  vi.spyOn(console, 'warn').mockImplementation(() => {}); // fabricated pointer capture
  editor._pointer.onPointerDown(down);
  for (const d of deltas) timeline(editor).dispatchEvent(pe('pointermove', 100 + d));
}

function release(editor: Editor, type: 'pointerup' | 'pointercancel', clientX: number): void {
  timeline(editor).dispatchEvent(pe(type, clientX));
}

describe('<daw-editor> clip move previews and commits once (#848)', () => {
  it('a move drag changes nothing in the arrangement until release, then is one moveClip and one undo step', async () => {
    const { editor, a } = await setup();
    const version = editor._arrangement.tracksVersion;
    const left = parseFloat(container(editor, a).style.left) || 0;
    drag(editor, a, [5, 8, 10]);
    expect(editor._arrangement.tracksVersion).toBe(version);
    expect(startOf(editor, a)).toBe(0);
    expect(parseFloat(container(editor, a).style.left)).toBe(left + 10);
    release(editor, 'pointerup', 110);
    expect(startOf(editor, a)).toBe(10 * SPP);
    expect(editor._arrangement.tracksVersion).toBe(version + 1);
    editor._arrangement.undo();
    expect(startOf(editor, a)).toBe(0);
    expect(editor._arrangement.canUndo).toBe(false);
  });

  it('a move drag stops at a neighbour, as the release does', async () => {
    const { editor, a } = await setup();
    const left = parseFloat(container(editor, a).style.left) || 0;
    // +100 px is 102400 samples; clip B starts 48000 samples after A ends.
    drag(editor, a, [50, 100]);
    expect(parseFloat(container(editor, a).style.left)).toBe(left + Math.round(SR / SPP));
    release(editor, 'pointerup', 200);
    expect(startOf(editor, a)).toBe(SR);
  });

  it('pointercancel during a move leaves the arrangement as it was and the clip where it was drawn', async () => {
    const { editor, a } = await setup();
    const version = editor._arrangement.tracksVersion;
    const left = parseFloat(container(editor, a).style.left) || 0;
    drag(editor, a, [20]);
    release(editor, 'pointercancel', 120);
    expect(editor._arrangement.tracksVersion).toBe(version);
    expect(startOf(editor, a)).toBe(0);
    expect(parseFloat(container(editor, a).style.left)).toBe(left);
    expect(editor._arrangement.canUndo).toBe(false);
  });

  it('Escape during a move leaves the arrangement as it was', async () => {
    const { editor, a } = await setup();
    const version = editor._arrangement.tracksVersion;
    drag(editor, a, [20]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(editor._clipPointer.isDragging).toBe(false);
    expect(editor._arrangement.tracksVersion).toBe(version);
    expect(startOf(editor, a)).toBe(0);
  });

  it("a page <daw-track> added during a clip drag enters at once and is not part of the drag's undo step", async () => {
    const { editor, a } = await setup();
    stubFetch({ '/c.wav': 'ok' });
    drag(editor, a, [10]);
    const added = document.createElement('daw-track');
    added.setAttribute('name', 'Late');
    editor.appendChild(added);
    await tick(3);
    expect(editor._arrangement.getTracks()).toHaveLength(2);
    release(editor, 'pointerup', 110);
    expect(startOf(editor, a)).toBe(10 * SPP);
    // One undo takes back the move only; the track added meanwhile stays.
    editor._arrangement.undo();
    expect(startOf(editor, a)).toBe(0);
    expect(editor._arrangement.getTracks()).toHaveLength(2);
  });
});
