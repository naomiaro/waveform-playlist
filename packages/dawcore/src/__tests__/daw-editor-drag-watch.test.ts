/**
 * A change to the arrangement made elsewhere while a drag is in progress
 * cancels the drag when it changed what is dragged (#848 PR 3, P2): the
 * dragged clip is gone or moved, or (track drag) the track is gone or the
 * order changed. Other changes let the drag go on.
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
  _trackReorderDrag: {
    isActive: boolean;
    onGrab(id: string, e: PointerEvent, grip: HTMLElement): void;
  };
  _arrangement: Arrangement;
  updateComplete: Promise<boolean>;
};

const editors: HTMLElement[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.remove();
  vi.restoreAllMocks();
});

const SR = 48000;
const pe = (type: string, x: number, y = 0) =>
  new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true });

async function mount(html: string, fake = makeFakeAdapter({ sampleRate: SR })): Promise<Editor> {
  const mounted = await mountEditor({
    adapter: fake.adapter,
    before: (e) => {
      stubPeakPipeline(e);
      e.setAttribute('interactive-clips', '');
      e.setAttribute('clip-headers', '');
      e.setAttribute('track-reordering', '');
    },
    html,
  });
  editors.push(mounted);
  return mounted as unknown as Editor;
}

const TWO_CLIPS =
  '<daw-track name="T"><daw-clip src="/a.wav" start="0" duration="1"></daw-clip>' +
  '<daw-clip src="/b.wav" start="2" duration="1"></daw-clip></daw-track>';
const TWO_TRACKS =
  '<daw-track name="A" kind="midi"></daw-track><daw-track name="B" kind="midi"></daw-track>';

function startOf(editor: Editor, clipId: string): number | undefined {
  for (const t of editor._arrangement.getTracks()) {
    const c = t.clips.find((x) => x.id === clipId);
    if (c && 'startSample' in c) return c.startSample;
  }
  return undefined;
}

function timeline(editor: Editor): HTMLElement {
  return editor.shadowRoot!.querySelector('.timeline') as HTMLElement;
}

async function dragClip(editor: Editor, clipId: string, dx: number): Promise<void> {
  await editor.updateComplete;
  const header = editor.shadowRoot!.querySelector(
    '.clip-header[data-clip-id="' + clipId + '"]'
  ) as HTMLElement;
  const down = pe('pointerdown', 100);
  Object.defineProperty(down, 'composedPath', { value: () => [header] });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  editor._pointer.onPointerDown(down);
  timeline(editor).dispatchEvent(pe('pointermove', 100 + dx));
  expect(editor._clipPointer.isDragging).toBe(true);
}

function grabTrack(editor: Editor, trackId: string): HTMLElement {
  const grip = document.createElement('button');
  editor.shadowRoot!.appendChild(grip);
  editor._trackReorderDrag.onGrab(trackId, pe('pointerdown', 0, 10), grip);
  expect(editor._trackReorderDrag.isActive).toBe(true);
  return grip;
}

const clipIds = (editor: Editor) =>
  [...editor.querySelectorAll('daw-clip')].map((c) => (c as unknown as { clipId: string }).clipId);

describe('<daw-editor> an outside change cancels a drag (#848)', () => {
  it('arrangement.undo() during a clip move that takes the clip back cancels the drag; the undo goes through', async () => {
    stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
    const editor = await mount(TWO_CLIPS);
    await settle(editor as never);
    const [a] = clipIds(editor);
    const trackId = editor._arrangement.getTracks()[0].id;
    editor._arrangement.moveClip(trackId, a, 12000);
    await dragClip(editor, a, 10);
    editor._arrangement.undo();
    expect(editor._clipPointer.isDragging).toBe(false);
    expect(startOf(editor, a)).toBe(0);
    timeline(editor).dispatchEvent(pe('pointerup', 110));
    expect(startOf(editor, a)).toBe(0);
    expect(editor._arrangement.canRedo).toBe(true);
  });

  it("arrangement.removeTrack of the dragged clip's track cancels the drag", async () => {
    stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
    const editor = await mount(TWO_CLIPS);
    await settle(editor as never);
    const [a] = clipIds(editor);
    await dragClip(editor, a, 10);
    editor._arrangement.removeTrack(editor._arrangement.getTracks()[0].id);
    expect(editor._clipPointer.isDragging).toBe(false);
  });

  it('arrangement.reorderTrack during a track drag cancels it', async () => {
    const editor = await mount(TWO_TRACKS);
    await editor.updateComplete;
    const [a, b] = editor._arrangement.getTracks().map((t) => t.id);
    const grip = grabTrack(editor, a);
    editor._arrangement.reorderTrack(b, 0);
    expect(editor._trackReorderDrag.isActive).toBe(false);
    grip.dispatchEvent(pe('pointerup', 0, 200));
    expect(editor._arrangement.getTracks().map((t) => t.id)).toEqual([b, a]);
  });

  it('another clip loading during a clip drag does not cancel it', async () => {
    stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
    const fake = makeFakeAdapter({ sampleRate: SR });
    const held = fake.holdDecode('/b.wav');
    const editor = await mount(TWO_CLIPS, fake);
    const [a, b] = clipIds(editor);
    for (let i = 0; i < 50 && startOf(editor, a) === undefined; i++) await tick();
    await dragClip(editor, a, 10);
    held.resolve();
    await settle(editor as never);
    expect(startOf(editor, b)).toBe(2 * SR);
    expect(editor._clipPointer.isDragging).toBe(true);
    timeline(editor).dispatchEvent(pe('pointerup', 110));
    expect(startOf(editor, a)).not.toBe(0);
  });

  it('a mixer change during a track drag does not cancel it', async () => {
    const editor = await mount(TWO_TRACKS);
    await editor.updateComplete;
    const [a, b] = editor._arrangement.getTracks().map((t) => t.id);
    grabTrack(editor, a);
    editor._arrangement.setTrackVolume(b, 0.5);
    expect(editor._trackReorderDrag.isActive).toBe(true);
  });

  it("a clip drag's own release is not taken for an outside change", async () => {
    stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
    const editor = await mount(TWO_CLIPS);
    await settle(editor as never);
    const [a] = clipIds(editor);
    const moves: unknown[] = [];
    editor.addEventListener('daw-clip-move', (e) => moves.push((e as CustomEvent).detail));
    await dragClip(editor, a, 10);
    timeline(editor).dispatchEvent(pe('pointerup', 110));
    expect(startOf(editor, a)).toBe(10 * 1024);
    expect(moves).toEqual([expect.objectContaining({ clipId: a, deltaSamples: 10 * 1024 })]);
  });
});
