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
    // The pressed clip, so a move drag can start (#848: it reads the clips).
    getState: vi.fn(() => ({
      tracks: [
        {
          id: 't1',
          clips: [{ id: 'c1', startSample: 0, durationSamples: 48000, offsetSamples: 0 }],
        },
      ],
    })),
    on: vi.fn(),
    dispose: vi.fn(),
    recordingTrackIds: new Set<string>(),
  };
}

/** The editor's members these tests reach (internal ones included). */
type TestEditor = HTMLElement & {
  adapter: unknown;
  updateComplete: Promise<boolean>;
  _engine: ReturnType<typeof makeEngine>;
  _pointer: { onPointerDown(e: PointerEvent): void };
  _clipPointer: { isActive: boolean };
  _trackReorderDrag: unknown;
  _annotationDrag: unknown;
  _dragInProgress: boolean;
  undo(): void;
  redo(): void;
  stop(): void;
};

async function setupEditor(withShortcuts = false): Promise<TestEditor> {
  const editor = document.createElement('daw-editor') as unknown as TestEditor;
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
function pressClipHeader(editor: TestEditor, clientX = 100): HTMLElement {
  const timeline = editor.shadowRoot!.querySelector('.timeline') as HTMLElement;
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
function grabTrack(editor: TestEditor): { handler: TrackReorderHandler; host: TrackReorderHost } {
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
    expect(editor._clipPointer.isActive).toBe(false);
    // Nothing was written during the drag, and the cancel writes nothing either.
    expect(editor._engine.moveClip).not.toHaveBeenCalled();
  });

  it('Escape cancels a track-reorder drag and an annotation edge drag', async () => {
    const editor = await setupEditor();
    const { handler, host } = grabTrack(editor);
    pressEscape();
    expect(handler.isActive).toBe(false);
    expect(host.reorderTrack).not.toHaveBeenCalled();

    const annotationDrag = { isActive: true, isDragging: true, cancel: vi.fn() };
    annotationDrag.cancel.mockImplementation(() => {
      annotationDrag.isActive = false;
      annotationDrag.isDragging = false;
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

  it('undo during a press, then a drag, is one moveClip on release (the press stays live)', async () => {
    const editor = await setupEditor();
    const timeline = pressClipHeader(editor);
    editor.undo();
    expect(editor._engine.undo).toHaveBeenCalledTimes(1);
    movePointer(timeline, 140);
    expect(editor._engine.moveClip).not.toHaveBeenCalled();
    timeline.dispatchEvent(new PointerEvent('pointerup', { clientX: 140, pointerId: 1 }));
    expect(editor._engine.moveClip).toHaveBeenCalledTimes(1);
  });

  it('Escape during a press that has not moved is left to the shortcuts', async () => {
    const editor = await setupEditor(true);
    const stop = vi.spyOn(editor, 'stop').mockImplementation(() => {});
    pressClipHeader(editor);
    const annotationDrag = { isActive: true, isDragging: false, cancel: vi.fn() };
    editor._annotationDrag = annotationDrag;
    expect(pressEscape().defaultPrevented).toBe(true); // by the Stop shortcut
    expect(stop).toHaveBeenCalledTimes(1);
    expect(editor._clipPointer.isActive).toBe(true);
    expect(annotationDrag.cancel).not.toHaveBeenCalled();
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
    expect(engine.moveClip).not.toHaveBeenCalled();
    document.body.appendChild(editor);
    expect(editor._dragInProgress).toBe(false);
  });
});
