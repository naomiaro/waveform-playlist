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
    const clipElA = elA.querySelector('daw-clip') as unknown as { clipId: string };
    const clipIdA = clipElA.clipId;
    const bufferBefore = editor._clipBuffers.get(clipIdA);
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
    // Same AudioBuffer reference — nothing re-fetched/re-decoded/re-finalized.
    expect(editor._clipBuffers.get(clipIdA)).toBe(bufferBefore);

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
