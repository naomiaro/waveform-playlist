import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import type { DawTrackElement } from '../elements/daw-track';

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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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
  for (let i = 0; i < trackCount; i++) {
    await editor.addTrack({ name: `T${i}`, midi: { notes: NOTES } });
  }
  await editor.updateComplete;
  return editor;
}

function makeAudioBuffer(durationSec = 1, sampleRate = 48000): AudioBuffer {
  const length = Math.round(durationSec * sampleRate);
  return {
    length,
    duration: durationSec,
    sampleRate,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(length),
  } as unknown as AudioBuffer;
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
    const editor = document.createElement('daw-editor') as any;
    editor.adapter = makeMockAdapter();
    document.body.appendChild(editor);
    editor._peakPipeline = makeMockPeakPipeline();

    // Hold the FIRST track's decode mid-flight so the SECOND track's decode
    // (mocked to resolve immediately) completes first — Map-insertion
    // (completion) order would then be [second, first], diverging from DOM
    // (append) order [first, second].
    let releaseFirst!: (b: AudioBuffer) => void;
    editor._fetchAndDecode = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<AudioBuffer>((resolve) => {
            releaseFirst = resolve;
          })
      )
      .mockResolvedValue(makeAudioBuffer());

    const firstPromise = editor.addTrack({
      name: 'First',
      clips: [{ src: '/a.wav', start: 0, duration: 1 }],
    });
    const secondPromise = editor.addTrack({
      name: 'Second',
      clips: [{ src: '/b.wav', start: 0, duration: 1 }],
    });

    await secondPromise; // second track's decode wins the race
    releaseFirst(makeAudioBuffer());
    await firstPromise;

    const domOrder = [...editor.querySelectorAll('daw-track')].map((el: any) => el.trackId);
    const engineOrder = editor.engine!.getState().tracks.map((t: { id: string }) => t.id);
    expect(engineOrder).toEqual(domOrder);
    editor.remove();
  });
});

describe('<daw-editor> track reordering — redundant reconnect guard (#612)', () => {
  it('does not re-fetch/re-decode audio or replace the clip buffer when a loaded audio track is moved', async () => {
    const editor = document.createElement('daw-editor') as any;
    editor.adapter = makeMockAdapter();
    document.body.appendChild(editor);
    editor._peakPipeline = makeMockPeakPipeline();

    const fetchAndDecodeSpy = vi.fn().mockResolvedValue(makeAudioBuffer());
    editor._fetchAndDecode = fetchAndDecodeSpy;

    const errorSpy = vi.fn();
    editor.addEventListener('daw-track-error', errorSpy);

    await editor.addTrack({ name: 'A', clips: [{ src: '/a.wav', start: 0, duration: 1 }] });
    await editor.addTrack({ name: 'B', clips: [{ src: '/b.wav', start: 0, duration: 1 }] });

    const [elA, elB] = [...editor.querySelectorAll('daw-track')] as DawTrackElement[];
    const clipElB = elB.querySelector('daw-clip') as unknown as { clipId: string };
    const clipIdB = clipElB.clipId;
    const bufferBefore = editor._clipBuffers.get(clipIdB);
    expect(bufferBefore).toBeDefined();
    const callsBefore = fetchAndDecodeSpy.mock.calls.length;

    editor.insertBefore(elB, elA); // consumer-initiated DOM reorder — fires
    // disconnectedCallback+connectedCallback on elB per custom-element spec.

    await vi.waitFor(() => {
      const order = editor.engine!.getState().tracks.map((t: { id: string }) => t.id);
      expect(order).toEqual([elB.trackId, elA.trackId]);
    });
    // Flush the deferred setTimeout(0) daw-track-connected / daw-clip-connected
    // re-dispatches fired by the moved element's connectedCallback.
    await new Promise((r) => setTimeout(r, 10));

    expect(fetchAndDecodeSpy.mock.calls.length).toBe(callsBefore);
    expect(errorSpy).not.toHaveBeenCalled();
    // Same AudioBuffer reference for moved track B — nothing re-fetched/re-decoded/re-finalized.
    expect(editor._clipBuffers.get(clipIdB)).toBe(bufferBefore);

    editor.remove();
  });

  it('keeps engine track clip ids unique and unchanged after a move settles', async () => {
    const editor = document.createElement('daw-editor') as any;
    editor.adapter = makeMockAdapter();
    document.body.appendChild(editor);
    editor._peakPipeline = makeMockPeakPipeline();
    editor._fetchAndDecode = vi.fn().mockResolvedValue(makeAudioBuffer());

    await editor.addTrack({ name: 'A', clips: [{ src: '/a.wav', start: 0, duration: 1 }] });
    await editor.addTrack({ name: 'B', clips: [{ src: '/b.wav', start: 0, duration: 1 }] });

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

describe('<daw-editor> engine-to-DOM reorder sync (#612)', () => {
  it('undo after a reorder moves the <daw-track> elements back', async () => {
    const editor = await makeEditor(2);
    const [elA, elB] = [...editor.querySelectorAll('daw-track')] as DawTrackElement[];
    editor.reorderTrack(elB.trackId, 0);
    await vi.waitFor(() => {
      expect([...editor.querySelectorAll('daw-track')][0]).toBe(elB);
    });
    editor.engine!.undo();
    await vi.waitFor(() => {
      expect([...editor.querySelectorAll('daw-track')][0]).toBe(elA);
      expect(editor.engine!.getState().tracks[0].id).toBe(elA.trackId);
    });
    editor.remove();
  });

  it('reorder sync converges under a 3-track permutation that forces 2 reorderTrack calls in one sync, without the engine->DOM handler bouncing mid-transaction', async () => {
    const editor = await makeEditor(3);
    const [elA, elB, elC] = [...editor.querySelectorAll('daw-track')] as DawTrackElement[];
    const reorderSpy = vi.spyOn(editor.engine!, 'reorderTrack');
    // White-box spy on the engine->DOM direction: this is the method the
    // `_inOrderSync` guard exists to suppress while a DOM->engine transaction
    // (_syncEngineOrderToDom) is in flight. NOTE: because
    // _syncEngineOrderToDom's forward-fill loop is self-correcting (its
    // LAST reorderTrack call always lands the fully-converged permutation,
    // by construction — every already-placed prefix position is never
    // revisited), the FINAL DOM/engine state and the reorderTrack call
    // count are identical whether or not the guard is present, for this
    // single-batch scenario. The only observable difference is that,
    // unguarded, `_syncDomToEngineOrder` fires once per mid-transaction
    // reorderTrack call (bouncing the DOM to intermediate, not-yet-final
    // orders) instead of zero times. That call-count is the load-bearing
    // assertion below (sabotage-verified: with the `!this._inOrderSync`
    // guard condition deleted, this spy is called 2 times instead of 0 —
    // see #612 PR notes).
    const domSyncSpy = vi.spyOn(
      editor as unknown as { _syncDomToEngineOrder: () => void },
      '_syncDomToEngineOrder'
    );

    // Two synchronous DOM mutations (no await between them) land in ONE
    // MutationObserver batch, so _syncEngineOrderToDom sees the SETTLED
    // order [c, b, a] (a full reversal) in a single call. Its forward-fill
    // selection-sort algorithm needs 2 reorderTrack calls to realize this
    // permutation (hand-traced against the algorithm in _syncEngineOrderToDom):
    //   current=[a,b,c] target=[c,b,a]
    //   i=0: c !== a -> reorderTrack(c, 0); current=[c,a,b]
    //   i=1: b !== a -> reorderTrack(b, 1); current=[c,b,a]
    //   i=2: a === a -> no call
    // A single-rotation permutation (e.g. insertBefore(elC, elA) alone,
    // giving [c,a,b]) only takes ONE reorderTrack call and would NOT
    // exercise the mid-transaction statechange path that _inOrderSync
    // guards — that was the weakness in the original 2-track version of
    // this test (2 tracks can only ever produce a single transposition).
    editor.insertBefore(elC, elA); // [c, a, b]
    editor.insertBefore(elB, elA); // [c, b, a]

    await vi.waitFor(() => {
      const order = editor.engine!.getState().tracks.map((t: { id: string }) => t.id);
      expect(order).toEqual([elC.trackId, elB.trackId, elA.trackId]);
    });
    const domOrder = [...editor.querySelectorAll('daw-track')].map((el: any) => el.trackId);
    expect(domOrder).toEqual([elC.trackId, elB.trackId, elA.trackId]);
    expect(reorderSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(domSyncSpy).not.toHaveBeenCalled(); // guard held for the whole transaction

    const calls = reorderSpy.mock.calls.length;
    await new Promise((r) => setTimeout(r, 50));
    expect(reorderSpy.mock.calls.length).toBe(calls); // settled, no further churn
    expect(domSyncSpy).not.toHaveBeenCalled();
    editor.remove();
  });
});

describe('<daw-editor track-reordering> UI-driven reorder (#612)', () => {
  it('clicking the rendered move-down button reorders both the engine and the DOM', async () => {
    const editor = document.createElement('daw-editor') as any;
    editor.adapter = makeMockAdapter();
    editor.setAttribute('track-reordering', '');
    document.body.appendChild(editor);
    await editor.addTrack({ name: 'A', midi: { notes: NOTES } });
    await editor.addTrack({ name: 'B', midi: { notes: NOTES } });
    await editor.updateComplete;

    const [elA, elB] = [...editor.querySelectorAll('daw-track')] as DawTrackElement[];

    const controlsEls = editor.shadowRoot!.querySelectorAll('daw-track-controls');
    expect(controlsEls.length).toBe(2);
    const firstControls = controlsEls[0] as HTMLElement & { updateComplete: Promise<boolean> };
    await firstControls.updateComplete;
    const downBtn = firstControls.shadowRoot!.querySelector('.reorder-down') as HTMLButtonElement;
    expect(downBtn).not.toBeNull();
    downBtn.click();

    await vi.waitFor(() => {
      const engineOrder = editor.engine!.getState().tracks.map((t: { id: string }) => t.id);
      expect(engineOrder).toEqual([elB.trackId, elA.trackId]);
      const domOrder = [...editor.querySelectorAll('daw-track')].map((el: any) => el.trackId);
      expect(domOrder).toEqual([elB.trackId, elA.trackId]);
    });

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
