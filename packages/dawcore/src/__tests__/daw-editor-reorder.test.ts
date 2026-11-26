import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import type { DawTrackElement } from '../elements/daw-track';
import {
  appendTrackElement,
  makeFakeAdapter,
  restoreFetch,
  settle,
  stubFetch,
} from './helpers/editor-harness';

beforeAll(async () => {
  // Register all elements before template cloning (happy-dom 20 upgrades
  // cloned elements only if the class is defined first).
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
  await import('../elements/daw-piano-roll');
});

beforeEach(() => {
  vi.stubGlobal('devicePixelRatio', 1);
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no fetch in reorder tests')));
});

afterEach(() => {
  restoreFetch();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** An editor whose arrangement loads through the harness's fetch and decoder (#848). */
function loadingEditor() {
  const fake = makeFakeAdapter();
  stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok', '/c.wav': 'ok' });
  const editor = document.createElement('daw-editor') as any;
  editor.adapter = fake.adapter;
  document.body.appendChild(editor);
  editor._peakPipeline = makeMockPeakPipeline();
  return { editor, fake };
}

function makeMockAdapter() {
  const ctx = {
    sampleRate: 48000,
    state: 'suspended' as AudioContextState,
    destination: {} as AudioDestinationNode,
    resume: vi.fn().mockResolvedValue(undefined),
    decodeAudioData: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    audioContext: ctx as unknown as AudioContext,
    ppqn: 960,
    setTracks: vi.fn(),
    updateTrack: vi.fn(),
    setTempo: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    init: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    isPlaying: vi.fn().mockReturnValue(false),
  };
}

const NOTES = [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }];

async function makeEditor(trackCount: number) {
  const editor = document.createElement('daw-editor') as any;
  editor.adapter = makeMockAdapter();
  document.body.appendChild(editor);
  // Page tracks (addTrack makes no element since #848).
  for (let i = 0; i < trackCount; i++) {
    await appendTrackElement(editor, { name: `T${i}`, midi: { notes: NOTES } });
  }
  await editor.updateComplete;
  return editor;
}

function makePeakData() {
  return { data: [new Int16Array(0)], length: 0, bits: 16 };
}

function makeMockPeakPipeline() {
  return {
    generatePeaks: vi.fn().mockResolvedValue(makePeakData()),
    cacheWaveformData: vi.fn(),
    getMaxCachedScale: vi.fn().mockReturnValue(0),
    getCachedScale: vi.fn().mockReturnValue(0),
    reextractPeaks: vi.fn().mockReturnValue(new Map()),
    terminate: vi.fn(),
  };
}

describe('<daw-editor> track reordering (#612)', () => {
  it('moving a <daw-track> element reorders the engine without teardown', async () => {
    const editor = await makeEditor(2);
    const [elA, elB] = [...editor.querySelectorAll('daw-track')] as DawTrackElement[];
    const removedSpy = vi.fn();
    editor.addEventListener('daw-track-removed', removedSpy);

    editor.insertBefore(elB, elA); // consumer-initiated DOM reorder
    await vi.waitFor(() => {
      const order = editor.engine!.getState().tracks.map((t: { id: string }) => t.id);
      expect(order).toEqual([elB.trackId, elA.trackId]);
    });
    expect(removedSpy).not.toHaveBeenCalled();
    // Track state survived — buffers/descriptors intact
    expect(editor.tracks.map((t: { trackId: string }) => t.trackId)).toContain(elA.trackId);
    editor.remove();
  });

  it('registers engine tracks in DOM order even when audio decode finishes out of order', async () => {
    const { editor, fake } = loadingEditor();

    // Hold the FIRST track's decode mid-flight so the SECOND track's decode
    // (mocked to resolve immediately) completes first — Map-insertion
    // (completion) order would then be [second, first], diverging from DOM
    // (append) order [first, second].
    const first = fake.holdDecode('/a.wav');

    const firstPromise = appendTrackElement(editor, {
      name: 'First',
      clips: [{ src: '/a.wav', start: 0, duration: 1 }],
    });
    const secondPromise = appendTrackElement(editor, {
      name: 'Second',
      clips: [{ src: '/b.wav', start: 0, duration: 1 }],
    });

    await secondPromise; // the second track's decode wins the race
    first.resolve();
    await firstPromise;
    await settle(editor);

    const domOrder = [...editor.querySelectorAll('daw-track')].map((el: any) => el.trackId);
    const engineOrder = editor.engine!.getState().tracks.map((t: { id: string }) => t.id);
    expect(engineOrder).toEqual(domOrder);
    editor.remove();
  });

  it('preserves the declared <daw-track> DOM order when decodes finish out of order (#625)', async () => {
    const { editor, fake } = loadingEditor();

    // Decode completion order is C, B, A — the reverse of the declared DOM
    // order [A, B, C]. Each completion calls engine.setTracks with only the
    // loaded subset; the statechange handler's _syncDomToEngineOrder must NOT
    // move that subset ahead of still-loading tracks (#625: tracks ended up
    // in load-completion order, breaking consumer grouping).
    const releaseA = fake.holdDecode('/a.wav');
    const releaseB = fake.holdDecode('/b.wav');

    const aPromise = appendTrackElement(editor, { name: 'A', clips: [{ src: '/a.wav' }] });
    const bPromise = appendTrackElement(editor, { name: 'B', clips: [{ src: '/b.wav' }] });
    const cPromise = appendTrackElement(editor, { name: 'C', clips: [{ src: '/c.wav' }] });
    // Elements are appended synchronously — this IS the declared order.
    const declaredOrder = [...editor.querySelectorAll('daw-track')].map((el: any) => el.trackId);
    expect(declaredOrder.length).toBe(3);

    await cPromise; // C's decode resolves at once and wins the race
    releaseB.resolve();
    await bPromise;
    releaseA.resolve();
    await aPromise;
    await settle(editor);
    await editor.updateComplete;

    const domOrder = [...editor.querySelectorAll('daw-track')].map((el: any) => el.trackId);
    expect(domOrder).toEqual(declaredOrder);
    const engineOrder = editor.engine!.getState().tracks.map((t: { id: string }) => t.id);
    expect(engineOrder).toEqual(declaredOrder);
    editor.remove();
  });
});

describe('<daw-editor> track reordering — redundant reconnect guard (#612)', () => {
  it('does not re-fetch/re-decode audio or replace the clip buffer when a loaded audio track is moved', async () => {
    const { editor, fake } = loadingEditor();

    const errorSpy = vi.fn();
    editor.addEventListener('daw-track-error', errorSpy);

    await appendTrackElement(editor, {
      name: 'A',
      clips: [{ src: '/a.wav', start: 0, duration: 1 }],
    });
    await appendTrackElement(editor, {
      name: 'B',
      clips: [{ src: '/b.wav', start: 0, duration: 1 }],
    });
    await settle(editor);

    const [elA, elB] = [...editor.querySelectorAll('daw-track')] as DawTrackElement[];
    const clipElB = elB.querySelector('daw-clip') as unknown as { clipId: string };
    const clipIdB = clipElB.clipId;
    const bufferBefore = editor._clipBuffers.get(clipIdB);
    expect(bufferBefore).toBeDefined();
    const decodesBefore = fake.decodeCount('/b.wav');

    editor.insertBefore(elB, elA); // consumer-initiated DOM reorder — fires
    // disconnectedCallback+connectedCallback on elB per custom-element spec.

    await vi.waitFor(() => {
      const order = editor.engine!.getState().tracks.map((t: { id: string }) => t.id);
      expect(order).toEqual([elB.trackId, elA.trackId]);
    });
    // Flush the deferred setTimeout(0) daw-track-connected / daw-clip-connected
    // re-dispatches fired by the moved element's connectedCallback.
    await new Promise((r) => setTimeout(r, 10));

    expect(fake.decodeCount('/b.wav')).toBe(decodesBefore);
    expect(errorSpy).not.toHaveBeenCalled();
    // Same AudioBuffer reference for moved track B — nothing re-fetched/re-decoded/re-finalized.
    expect(editor._clipBuffers.get(clipIdB)).toBe(bufferBefore);

    editor.remove();
  });

  it('keeps engine track clip ids unique and unchanged after a move settles', async () => {
    const { editor } = loadingEditor();
    await appendTrackElement(editor, {
      name: 'A',
      clips: [{ src: '/a.wav', start: 0, duration: 1 }],
    });
    await appendTrackElement(editor, {
      name: 'B',
      clips: [{ src: '/b.wav', start: 0, duration: 1 }],
    });
    await settle(editor);

    const [elA, elB] = [...editor.querySelectorAll('daw-track')] as DawTrackElement[];
    type EngineTrack = { id: string; clips: { id: string }[] };
    // elB is the element being moved (insertBefore(elB, elA)) — its
    // disconnectedCallback+connectedCallback (and its <daw-clip> child's)
    // fire per custom-element spec, so it's the track whose clip list is at
    // risk of gaining a duplicate entry.
    const trackBBefore = editor
      .engine!.getState()
      .tracks.find((t: EngineTrack) => t.id === elB.trackId) as EngineTrack;
    const clipIdsBefore = trackBBefore.clips.map((c) => c.id).sort();

    editor.insertBefore(elB, elA);

    await vi.waitFor(() => {
      const order = editor.engine!.getState().tracks.map((t: { id: string }) => t.id);
      expect(order).toEqual([elB.trackId, elA.trackId]);
    });
    await new Promise((r) => setTimeout(r, 10));

    const trackBAfter = editor
      .engine!.getState()
      .tracks.find((t: EngineTrack) => t.id === elB.trackId) as EngineTrack;
    const clipIdsAfter = trackBAfter.clips.map((c) => c.id);
    expect(new Set(clipIdsAfter).size).toBe(clipIdsAfter.length); // no duplicate ids
    expect(clipIdsAfter.slice().sort()).toEqual(clipIdsBefore);

    editor.remove();
  });
});

describe('<daw-editor track-reordering> UI-driven reorder (#612)', () => {
  it('clicking the rendered move-down button reorders the arrangement and moves no element (#848)', async () => {
    const editor = document.createElement('daw-editor') as any;
    editor.adapter = makeMockAdapter();
    editor.setAttribute('track-reordering', '');
    document.body.appendChild(editor);
    const a = await editor.addTrack({ name: 'A', midi: { notes: NOTES } });
    const b = await editor.addTrack({ name: 'B', midi: { notes: NOTES } });
    await editor.updateComplete;
    const domBefore = [...editor.querySelectorAll('daw-track')].map((el: any) => el.trackId);

    const controlsEls = editor.shadowRoot!.querySelectorAll('daw-track-controls');
    expect(controlsEls.length).toBe(2);
    const firstControls = controlsEls[0] as HTMLElement & { updateComplete: Promise<boolean> };
    await firstControls.updateComplete;
    const downBtn = firstControls.shadowRoot!.querySelector('.reorder-down') as HTMLButtonElement;
    expect(downBtn).not.toBeNull();
    downBtn.click();

    await vi.waitFor(() => {
      const engineOrder = editor.engine!.getState().tracks.map((t: { id: string }) => t.id);
      expect(engineOrder).toEqual([b, a]);
    });
    const domOrder = [...editor.querySelectorAll('daw-track')].map((el: any) => el.trackId);
    expect(domOrder).toEqual(domBefore);

    editor.remove();
  });
});

describe('<daw-editor> reorderTrack input hardening (#612)', () => {
  it('warns and no-ops for a non-finite toIndex', async () => {
    const editor = await makeEditor(2);
    const [elA, elB] = [...editor.querySelectorAll('daw-track')] as DawTrackElement[];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    editor.reorderTrack(elB.trackId, NaN);

    const domOrder = [...editor.querySelectorAll('daw-track')].map((el: any) => el.trackId);
    expect(domOrder).toEqual([elA.trackId, elB.trackId]); // unchanged
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('reorderTrack: invalid toIndex'));

    editor.reorderTrack(elB.trackId, Infinity);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('reorderTrack: invalid toIndex'));
    const domOrderAfter = [...editor.querySelectorAll('daw-track')].map((el: any) => el.trackId);
    expect(domOrderAfter).toEqual([elA.trackId, elB.trackId]); // still unchanged

    editor.remove();
  });

  it('warns when trackId matches neither a DOM element nor an engine track', async () => {
    const editor = await makeEditor(2);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    editor.reorderTrack('does-not-exist', 0);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('reorderTrack: no track found for id "does-not-exist"')
    );

    editor.remove();
  });
});

// #848 PR 3 (P13): the editor never moves its children. A DOM move is a
// reorder request; reorderTrack and an undo change the arrangement only.
describe('<daw-editor> DOM order is a request (#848)', () => {
  const PAGE =
    '<daw-track name="A" kind="midi"></daw-track>' +
    '<daw-track name="B" kind="midi"></daw-track>' +
    '<daw-track name="C" kind="midi"></daw-track>';

  async function pageEditor() {
    const editor = document.createElement('daw-editor') as any;
    editor.adapter = makeFakeAdapter().adapter;
    editor.innerHTML = PAGE;
    document.body.appendChild(editor);
    await vi.waitFor(() => expect(editor._arrangement.getTracks()).toHaveLength(3));
    await editor.updateComplete;
    return editor;
  }
  type Editor = HTMLElement & {
    _arrangement: { getTracks(): readonly { id: string; name?: string; clips: unknown[] }[] };
  };
  const names = (editor: Editor) => editor._arrangement.getTracks().map((t) => t.name);
  const domNames = (editor: Editor) =>
    [...editor.querySelectorAll('daw-track')].map((el) => el.getAttribute('name'));
  const flush = () => new Promise((r) => setTimeout(r, 0));

  afterEach(() => {
    document.querySelectorAll('daw-editor').forEach((e) => e.remove());
  });

  it('reorderTrack changes the arrangement order and moves no element', async () => {
    const editor = await pageEditor();
    const c = editor._arrangement.getTracks()[2].id;
    editor.reorderTrack(c, 0);
    await flush();
    expect(names(editor)).toEqual(['C', 'A', 'B']);
    expect(domNames(editor)).toEqual(['A', 'B', 'C']);
  });

  it('moving a <daw-track> before another reorders the arrangement, one undo step', async () => {
    const editor = await pageEditor();
    const [a, , c] = [...editor.querySelectorAll('daw-track')];
    editor.insertBefore(c, a);
    await flush();
    expect(names(editor)).toEqual(['C', 'A', 'B']);
    editor._arrangement.undo();
    expect(names(editor)).toEqual(['A', 'B', 'C']);
    expect(editor._arrangement.canUndo).toBe(false);
  });

  it('two elements moved in one task are one undo step', async () => {
    const editor = await pageEditor();
    const [a, b, c] = [...editor.querySelectorAll('daw-track')];
    editor.append(b, a); // C, B, A
    void c;
    await flush();
    expect(names(editor)).toEqual(['C', 'B', 'A']);
    editor._arrangement.undo();
    expect(names(editor)).toEqual(['A', 'B', 'C']);
    expect(editor._arrangement.canUndo).toBe(false);
  });

  it('undo of a reorder moves no element', async () => {
    const editor = await pageEditor();
    const [a, , c] = [...editor.querySelectorAll('daw-track')];
    editor.insertBefore(c, a);
    await flush();
    editor._arrangement.undo();
    await flush();
    expect(domNames(editor)).toEqual(['C', 'A', 'B']);
    expect(names(editor)).toEqual(['A', 'B', 'C']);
  });

  it('a re-render that writes the same attributes and order is no undo step', async () => {
    const editor = await pageEditor();
    const els = [...editor.querySelectorAll('daw-track')] as HTMLElement[];
    for (const el of els) el.setAttribute('name', el.getAttribute('name')!);
    editor.append(...els); // the same order, every element moved
    await flush();
    expect(names(editor)).toEqual(['A', 'B', 'C']);
    expect(editor._arrangement.canUndo).toBe(false);
  });

  it('a <daw-clip> removed while the editor was detached is removed from its track at reconnect', async () => {
    const editor = document.createElement('daw-editor') as any;
    editor.adapter = makeFakeAdapter().adapter;
    editor._peakPipeline = makeMockPeakPipeline();
    editor.innerHTML =
      '<daw-track name="M" kind="midi"><daw-clip duration="1"></daw-clip></daw-track>';
    document.body.appendChild(editor);
    await vi.waitFor(() => expect(editor._arrangement.getTracks()[0]?.clips).toHaveLength(1));
    editor.remove();
    editor.querySelector('daw-clip').remove();
    document.body.appendChild(editor);
    expect(editor._arrangement.getTracks()[0].clips).toHaveLength(0);
  });
});
