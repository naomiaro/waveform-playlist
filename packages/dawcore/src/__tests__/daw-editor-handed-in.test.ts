/**
 * `editor.arrangement` can be handed in (#848 PR 3, P5-P7): the editor plays
 * it alone (the `srcObject` model), keeps the adapter across the swap, and
 * goes back to its own arrangement on `null`.
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { createArrangement, type Arrangement } from '@waveform-playlist/engine';
import { createTrack } from '@waveform-playlist/core';
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

type Editor = HTMLElement & {
  arrangement: Arrangement | null;
  _arrangement: Arrangement;
  adapter: unknown;
  tracks: { trackId: string; name: string }[];
  isPlaying: boolean;
  play(): Promise<void>;
  addTrack(config: object): Promise<string>;
  startRecording(stream: MediaStream): Promise<void>;
  isRecording: boolean;
  engine: { getState(): { isPlaying: boolean } } | null;
};

const editors: HTMLElement[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.remove();
  vi.restoreAllMocks();
});

const PAGE = '<daw-track name="Page" kind="midi"></daw-track>';

async function setup(fake = makeFakeAdapter()): Promise<{ editor: Editor; fake: typeof fake }> {
  stubFetch({ '/a.wav': 'ok' });
  const mounted = await mountEditor({
    adapter: fake.adapter,
    before: (e) => stubPeakPipeline(e),
    html: PAGE,
  });
  editors.push(mounted);
  await settle(mounted);
  return { editor: mounted as unknown as Editor, fake };
}

function other(name = 'Other'): Arrangement {
  return createArrangement({
    tracks: [{ ...createTrack({ name, kind: 'midi', clips: [] }), id: 'other-1' }],
  });
}

const isDetached = (el: Element) => states.get(el as HTMLElement)?.has('detached') ?? false;

describe('<daw-editor> editor.arrangement (#848)', () => {
  it('editor.arrangement is the own one until one is handed in', async () => {
    const { editor } = await setup();
    const own = editor.arrangement;
    expect(own?.getTracks().map((t) => t.name)).toEqual(['Page']);
    const handed = other();
    editor.arrangement = handed;
    expect(editor.arrangement).toBe(handed);
  });

  it('a handed-in arrangement is played alone; the children are detached and not added to it', async () => {
    const { editor } = await setup();
    const handed = other();
    editor.arrangement = handed;
    await tick(2);
    expect(editor.tracks.map((t) => t.name)).toEqual(['Other']);
    expect(handed.getTracks()).toHaveLength(1);
    expect(isDetached(editor.querySelector('daw-track')!)).toBe(true);
  });

  it('a swap with an engine keeps the adapter, stops playback once and sends the new tracks', async () => {
    const { editor, fake } = await setup();
    await editor.play();
    const stops: string[] = [];
    editor.addEventListener('daw-stop', (e) => stops.push(e.type));
    const setTracks = fake.adapter.setTracks as ReturnType<typeof vi.fn>;
    setTracks.mockClear();
    editor.arrangement = other();
    expect(fake.adapter.dispose).not.toHaveBeenCalled();
    expect(stops).toHaveLength(1);
    expect(editor.engine?.getState().isPlaying).toBe(false);
    expect(setTracks.mock.lastCall?.[0].map((t: { id: string }) => t.id)).toEqual(['other-1']);
  });

  it('null returns to the own arrangement with its tracks and history', async () => {
    const { editor } = await setup();
    const own = editor.arrangement!;
    own.setTrackVolume(own.getTracks()[0].id, 0.5);
    editor.arrangement = other();
    editor.arrangement = null;
    expect(editor.arrangement).toBe(own);
    expect(editor.tracks.map((t) => t.name)).toEqual(['Page']);
    expect(own.canUndo).toBe(true);
    expect(isDetached(editor.querySelector('daw-track')!)).toBe(false);
  });

  it('daw-track-ready fires for each track of the arrangement swapped in', async () => {
    const { editor } = await setup();
    const ready: string[] = [];
    editor.addEventListener('daw-track-ready', (e) =>
      ready.push((e as CustomEvent<{ trackId: string }>).detail.trackId)
    );
    editor.arrangement = other();
    await tick(2);
    expect(ready).toEqual(['other-1']);
  });

  it('a non-arrangement throws a TypeError and changes nothing', async () => {
    const { editor } = await setup();
    const own = editor.arrangement;
    expect(() => {
      (editor as unknown as { arrangement: unknown }).arrangement = { getTracks: () => [] };
    }).toThrow(TypeError);
    expect(editor.arrangement).toBe(own);
  });

  it('a swap during a take is refused with a warning', async () => {
    const { editor } = await setup();
    Object.defineProperty(editor, 'isRecording', { get: () => true, configurable: true });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const own = editor.arrangement;
    editor.arrangement = other();
    expect(editor.arrangement).toBe(own);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/stopRecording/);
  });

  it('a <daw-track> added while handed in enters the own arrangement when it is played again', async () => {
    const { editor } = await setup();
    const own = editor.arrangement!;
    const handed = other();
    editor.arrangement = handed;
    const late = document.createElement('daw-track');
    late.setAttribute('name', 'Late');
    late.setAttribute('kind', 'midi');
    editor.appendChild(late);
    await tick(3);
    expect(handed.getTracks().map((t) => t.name)).toEqual(['Other']);
    expect(own.getTracks().map((t) => t.name)).toEqual(['Page']);
    editor.arrangement = null;
    await tick(3);
    expect(own.getTracks().map((t) => t.name)).toEqual(['Page', 'Late']);
  });

  it('a <daw-track> removed while handed in has its track removed from the own arrangement', async () => {
    const { editor } = await setup();
    const own = editor.arrangement!;
    editor.arrangement = other();
    editor.querySelector('daw-track')!.remove();
    await tick(2);
    expect(own.getTracks()).toHaveLength(0);
    expect(editor.tracks.map((t) => t.name)).toEqual(['Other']);
  });

  it('effects chains of tracks the new arrangement does not hold are disposed', async () => {
    const { editor } = await setup();
    const pageId = editor.arrangement!.getTracks()[0].id;
    // The chains themselves need a real audio graph; what the swap decides is
    // which track ids lose theirs.
    const manager = { disposeTrackChain: vi.fn(), disposeAll: vi.fn(), rewireTrackChains: vi.fn() };
    (editor as unknown as { _effectsManager: unknown })._effectsManager = manager;
    editor.arrangement = other();
    expect(manager.disposeTrackChain.mock.calls).toEqual([[pageId]]);
  });
  it('the editor never disposes or clears the history of a handed-in arrangement', async () => {
    const { editor } = await setup();
    const handed = other();
    handed.setTrackVolume('other-1', 0.2);
    editor.arrangement = handed;
    editor.arrangement = null;
    editor.remove();
    expect(handed.canUndo).toBe(true);
    expect(handed.getTracks()).toHaveLength(1);
  });

  it('a handed-in arrangement set before an adapter is played once the adapter arrives', async () => {
    const mounted = await mountEditor({ adapter: null, before: (e) => stubPeakPipeline(e) });
    editors.push(mounted);
    const editor = mounted as unknown as Editor;
    editor.arrangement = other('Early');
    editor.adapter = makeFakeAdapter().adapter;
    await tick(2);
    expect(editor.tracks.map((t) => t.name)).toEqual(['Early']);
    expect(editor.engine).not.toBeNull();
  });
});
