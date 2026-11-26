/**
 * Undo and redo do nothing while a drag is in progress, and Escape cancels the
 * drag and does nothing else (#848). The editor's handlers are the real ones;
 * the engine is a stub (a pre-stubbed `_engine`, see notes/testing.md).
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { TrackReorderHandler, type TrackReorderHost } from '../interactions/track-reorder-handler';

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-keyboard-shortcuts');
});

const editors: HTMLElement[] = [];

afterEach(() => {
  for (const editor of editors.splice(0)) editor.remove();
  vi.restoreAllMocks();
});

function makeEngine() {
  return {
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: true,
    canRedo: true,
    beginTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    abortTransaction: vi.fn(),
    moveClip: vi.fn((_t: string, _c: string, delta: number) => delta),
    trimClip: vi.fn(),
    updateTrack: vi.fn(),
    constrainTrimDelta: vi.fn((_t: string, _c: string, _b: string, d: number) => d),
    getClipBounds: vi.fn(() => ({
      offsetSamples: 0,
      durationSamples: 48000,
      startSample: 0,
      sourceDurationSamples: 96000,
    })),
    stop: vi.fn(),
    play: vi.fn(),
    seek: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
    getState: vi.fn(() => ({ tracks: [] })),
    on: vi.fn(),
    dispose: vi.fn(),
    recordingTrackIds: new Set<string>(),
  };
}

async function setupEditor(withShortcuts = false): Promise<any> {
  const editor = document.createElement('daw-editor') as any;
  editor.setAttribute('interactive-clips', '');
  editor.adapter = { audioContext: { state: 'running', sampleRate: 48000 } };
  if (withShortcuts) {
    editor
      .appendChild(document.createElement('daw-keyboard-shortcuts'))
      .setAttribute('playback', '');
  }
  document.body.appendChild(editor);
  editors.push(editor);
  editor._engine = makeEngine();
  await editor.updateComplete;
  return editor;
}

/** Press a clip header inside the editor's timeline, as the pointer would. */
function pressClipHeader(editor: any, clientX = 100): HTMLElement {
  const timeline = editor.shadowRoot.querySelector('.timeline') as HTMLElement;
  const header = document.createElement('div');
  header.className = 'clip-header';
  header.dataset.clipId = 'c1';
  header.dataset.trackId = 't1';
  header.dataset.interactive = '';
  timeline.appendChild(header);
  const down = new PointerEvent('pointerdown', { clientX, pointerId: 1, bubbles: true });
  Object.defineProperty(down, 'composedPath', { value: () => [header] });
  vi.spyOn(console, 'warn').mockImplementation(() => {}); // fabricated pointer capture
  editor._pointer.onPointerDown(down);
  return timeline;
}

function movePointer(timeline: HTMLElement, clientX: number) {
  timeline.dispatchEvent(new PointerEvent('pointermove', { clientX, pointerId: 1, bubbles: true }));
}

/** A track-reorder handler on a column of its own (the editor has no tracks here). */
function grabTrack(editor: any): { handler: TrackReorderHandler; host: TrackReorderHost } {
  const column = document.createElement('div');
  column.className = 'controls-column';
  const rows = ['a', 'b'].map((id, i) => {
    const el = document.createElement('daw-track-controls') as HTMLElement & { trackId: string };
    el.trackId = id;
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      top: i * 80,
      height: 80,
    } as DOMRect);
    column.appendChild(el);
    return el;
  });
  const host: TrackReorderHost = {
    isConnected: true,
    reorderTrack: vi.fn(),
    shadowRoot: {
      querySelector: (sel: string) => (sel === '.controls-column' ? column : null),
    } as unknown as ShadowRoot,
  };
  const handler = new TrackReorderHandler(host);
  editor._trackReorderDrag = handler;
  const grip = document.createElement('button');
  rows[0].appendChild(grip);
  handler.onGrab('a', new PointerEvent('pointerdown', { pointerId: 2, clientY: 40 }), grip);
  return { handler, host };
}

function pressEscape(): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  document.body.dispatchEvent(event);
  return event;
}

describe('<daw-editor> during a drag (#848)', () => {
  it('undo and redo do nothing while a clip drag is in progress', async () => {
    const editor = await setupEditor();
    const timeline = pressClipHeader(editor);
    movePointer(timeline, 110);
    editor.undo();
    editor.redo();
    expect(editor._engine.undo).not.toHaveBeenCalled();
    expect(editor._engine.redo).not.toHaveBeenCalled();
    timeline.dispatchEvent(new PointerEvent('pointerup', { clientX: 110, pointerId: 1 }));
    editor.undo();
    expect(editor._engine.undo).toHaveBeenCalledTimes(1);
  });

  it('undo works while a clip is pressed but not yet dragged', async () => {
    const editor = await setupEditor();
    pressClipHeader(editor);
    editor.undo();
    expect(editor._engine.undo).toHaveBeenCalledTimes(1);
  });

  it('undo and redo do nothing while a track-reorder drag is in progress', async () => {
    const editor = await setupEditor();
    const { handler } = grabTrack(editor);
    editor.undo();
    editor.redo();
    expect(editor._engine.undo).not.toHaveBeenCalled();
    expect(editor._engine.redo).not.toHaveBeenCalled();
    handler.cancel();
    editor.redo();
    expect(editor._engine.redo).toHaveBeenCalledTimes(1);
  });

  it('Escape cancels a clip drag and prevents its default', async () => {
    const editor = await setupEditor();
    const timeline = pressClipHeader(editor);
    movePointer(timeline, 140);
    const event = pressEscape();
    expect(event.defaultPrevented).toBe(true);
    expect(editor._engine.abortTransaction).toHaveBeenCalledTimes(1);
    expect(editor._clipPointer.isActive).toBe(false);
  });

  it('Escape cancels a track-reorder drag and an annotation edge drag', async () => {
    const editor = await setupEditor();
    const { handler, host } = grabTrack(editor);
    pressEscape();
    expect(handler.isActive).toBe(false);
    expect(host.reorderTrack).not.toHaveBeenCalled();

    const annotationDrag = { isActive: true, cancel: vi.fn() };
    annotationDrag.cancel.mockImplementation(() => {
      annotationDrag.isActive = false;
    });
    editor._annotationDrag = annotationDrag;
    expect(pressEscape().defaultPrevented).toBe(true);
    expect(annotationDrag.cancel).toHaveBeenCalledTimes(1);
  });

  it('Escape during a drag does not stop playback; a second Escape does', async () => {
    const editor = await setupEditor(true);
    const stop = vi.spyOn(editor, 'stop').mockImplementation(() => {});
    const timeline = pressClipHeader(editor);
    movePointer(timeline, 140);
    pressEscape();
    expect(stop).not.toHaveBeenCalled();
    pressEscape();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('Escape with no drag in progress is left alone', async () => {
    await setupEditor();
    expect(pressEscape().defaultPrevented).toBe(false);
  });

  it('a drag cut short by disconnect leaves no drag in progress after reconnect', async () => {
    const editor = await setupEditor();
    const engine = editor._engine;
    const timeline = pressClipHeader(editor);
    movePointer(timeline, 140);
    editor.remove();
    expect(engine.abortTransaction).toHaveBeenCalledTimes(1);
    document.body.appendChild(editor);
    expect(editor._dragInProgress).toBe(false);
  });
});
