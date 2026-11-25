import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

// #843: the arrangement owns a track's mix in <daw-editor> too. The controls
// and editor.tracks read it from the engine's tracks (`_engineTracks`, which
// follows `mixerVersion`), so an engine undo moves them back. A track that
// is still loading has no entry in the arrangement yet: the editor holds the
// values it will enter with (the seed), and a control moved meanwhile
// changes the seed, not the history.

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
  // happy-dom 20 upgrades cloned <daw-piano-roll> only if defined before cloning.
  await import('../elements/daw-piano-roll');
});

beforeEach(() => {
  vi.stubGlobal('devicePixelRatio', 1);
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch should not be called')));
});

afterEach(() => {
  document.body.querySelectorAll('daw-editor').forEach((el) => el.remove());
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
    setTrackVolume: vi.fn(),
    setTrackMute: vi.fn(),
    setTrackSolo: vi.fn(),
    setTrackPan: vi.fn(),
    init: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    isPlaying: vi.fn().mockReturnValue(false),
  };
}

function midiTrackConfig(name: string, volume?: number) {
  return {
    name,
    ...(volume !== undefined && { volume }),
    midi: {
      notes: [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }],
    },
  };
}

function makeAudioBuffer(durationSec = 2, sampleRate = 48000): AudioBuffer {
  const length = Math.round(durationSec * sampleRate);
  return {
    length,
    duration: durationSec,
    sampleRate,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(length),
  } as unknown as AudioBuffer;
}

function stubPeakPipeline(editor: any) {
  editor._peakPipeline = {
    generatePeaks: vi.fn().mockResolvedValue({ data: [new Int16Array(0)], length: 0, bits: 16 }),
    cacheWaveformData: vi.fn(),
    getMaxCachedScale: vi.fn().mockReturnValue(0),
    getCachedScale: vi.fn().mockReturnValue(0),
    reextractPeaks: vi.fn().mockReturnValue(new Map()),
    terminate: vi.fn(),
  };
}

async function makeEditor() {
  const editor = document.createElement('daw-editor') as any;
  const adapter = makeMockAdapter();
  editor.adapter = adapter;
  document.body.appendChild(editor);
  return { editor, adapter };
}

function controlsFor(editor: any, trackId: string): any {
  const all = [...editor.shadowRoot.querySelectorAll('daw-track-controls')] as any[];
  return all.find((c) => c.trackId === trackId);
}

function moveControl(editor: any, trackId: string, prop: string, value: unknown) {
  editor.dispatchEvent(
    new CustomEvent('daw-track-control', {
      bubbles: true,
      composed: true,
      detail: { trackId, prop, value },
    })
  );
}

describe('<daw-editor> draws the arrangement mix (#843)', () => {
  it('the controls follow an engine undo of a volume change', async () => {
    const { editor } = await makeEditor();
    const trackEl = await editor.addTrack(midiTrackConfig('A', 0.8));
    const id: string = trackEl.trackId;
    const engine = editor.engine;

    engine.setTrackVolume(id, 0.5);
    await editor.updateComplete;
    expect(controlsFor(editor, id).volume).toBe(0.5);

    engine.undo();
    await editor.updateComplete;
    expect(controlsFor(editor, id).volume).toBe(0.8);

    engine.redo();
    await editor.updateComplete;
    expect(controlsFor(editor, id).volume).toBe(0.5);
  });

  it('editor.tracks reports the arrangement mix after an undo', async () => {
    const { editor } = await makeEditor();
    const trackEl = await editor.addTrack(midiTrackConfig('A', 0.8));
    const id: string = trackEl.trackId;

    moveControl(editor, id, 'volume', 0.5);
    moveControl(editor, id, 'muted', true);
    expect(editor.tracks[0]).toMatchObject({ trackId: id, volume: 0.5, muted: true });

    editor.engine.undo(); // the mute
    editor.engine.undo(); // the volume
    expect(editor.tracks[0]).toMatchObject({ trackId: id, volume: 0.8, muted: false });
  });

  it('a control moved while the track is loading is the volume it enters with, and is not a step', async () => {
    const { editor } = await makeEditor();
    stubPeakPipeline(editor);
    const a = await editor.addTrack(midiTrackConfig('A'));
    const engine = editor.engine;
    engine.setTrackVolume(a.trackId, 0.5); // one step in the history
    expect(engine.canUndo).toBe(true);

    let releaseDecode!: (b: AudioBuffer) => void;
    editor._fetchAndDecode = vi.fn(
      () =>
        new Promise<AudioBuffer>((resolve) => {
          releaseDecode = resolve;
        })
    );
    const setVolume = vi.spyOn(engine, 'setTrackVolume');
    const pending = editor.addTrack({ name: 'B', volume: 0.8, clips: [{ src: '/b.opus' }] });
    await vi.waitFor(() => expect(editor._fetchAndDecode).toHaveBeenCalled());
    const bId = [...editor._tracks.keys()].find((k: string) => k !== a.trackId) as string;

    moveControl(editor, bId, 'volume', 0.3);
    await editor.updateComplete;

    // The seed holds it: shown and reported, nothing sent to the engine.
    expect(editor.tracks.find((t: any) => t.trackId === bId).volume).toBe(0.3);
    expect(setVolume).not.toHaveBeenCalled();
    // Not a step: one undo takes back A's volume and leaves nothing to undo.
    engine.undo();
    expect(engine.canUndo).toBe(false);

    releaseDecode(makeAudioBuffer());
    await pending;
    await editor.updateComplete;

    const entered = engine.getState().tracks.find((t: any) => t.id === bId);
    expect(entered.volume).toBe(0.3);
    expect(controlsFor(editor, bId).volume).toBe(0.3);
    // The seed is gone once the arrangement holds the track.
    expect(editor._seedMix.has(bId)).toBe(false);
  });

  it('a control moved while the load waits for the engine is the volume the track enters with', async () => {
    const { editor } = await makeEditor();
    const engine = await editor.ready();
    // A first statechange, as a loaded track would have brought: the
    // editor's first one always refreshes its engine-track cache.
    engine.setTracks([]);
    // Hold the load at its last await, after the track is built.
    let release!: () => void;
    editor._ensureEngine = () =>
      new Promise((resolve) => {
        release = () => resolve(engine);
      });
    const pending = editor.addTrack(midiTrackConfig('A', 0.8));
    await vi.waitFor(() => expect(release).toBeDefined());
    const id = [...editor._tracks.keys()][0] as string;

    moveControl(editor, id, 'volume', 0.3);
    release();
    await pending;

    expect(engine.getState().tracks.find((t: any) => t.id === id).volume).toBe(0.3);
    expect(editor.tracks[0].volume).toBe(0.3);
  });

  it('a synthesized descriptor after an undo has no mixer fields of its own', async () => {
    const { editor } = await makeEditor();
    await editor.addTrack(midiTrackConfig('A'));
    const b = await editor.addTrack(midiTrackConfig('B', 0.6));
    const bId: string = b.trackId;

    b.remove(); // the MutationObserver removes the track from the engine
    await vi.waitFor(() => expect(editor._tracks.has(bId)).toBe(false));
    editor.engine.undo(); // the removal

    const desc = editor._tracks.get(bId);
    expect(desc).toBeDefined();
    for (const field of ['volume', 'pan', 'muted', 'soloed']) {
      expect(desc).not.toHaveProperty(field);
    }
    expect(editor.tracks.find((t: any) => t.trackId === bId)).toMatchObject({
      name: 'B',
      volume: 0.6,
      pan: 0,
      muted: false,
      soloed: false,
    });
  });
});

// #843: an attribute change names what changed, and the editor sends only
// those mixer properties. An update that changes several is one undo step.
describe('<daw-editor> track updates and undo steps (#843)', () => {
  function volumeOf(editor: any, id: string): number {
    return editor.engine.getState().tracks.find((t: any) => t.id === id).volume;
  }
  function panOf(editor: any, id: string): number {
    return editor.engine.getState().tracks.find((t: any) => t.id === id).pan;
  }

  it("a name change after an undo does not write the element's volume back", async () => {
    const { editor } = await makeEditor();
    const trackEl = await editor.addTrack(midiTrackConfig('A', 0.8));
    const id: string = trackEl.trackId;
    const engine = editor.engine;

    trackEl.volume = 0.5;
    await trackEl.updateComplete;
    expect(volumeOf(editor, id)).toBe(0.5);

    engine.undo();
    expect(volumeOf(editor, id)).toBe(0.8);
    expect(engine.canRedo).toBe(true);

    // The element still says 0.5; only its name changes.
    trackEl.setAttribute('name', 'Renamed');
    await trackEl.updateComplete;

    expect(editor._tracks.get(id).name).toBe('Renamed');
    expect(volumeOf(editor, id)).toBe(0.8);
    expect(engine.canRedo).toBe(true);
  });

  it('setting volume and pan in one update is one step', async () => {
    const { editor } = await makeEditor();
    const trackEl = await editor.addTrack(midiTrackConfig('A', 0.8));
    const id: string = trackEl.trackId;
    const engine = editor.engine;

    trackEl.volume = 0.5;
    trackEl.pan = -0.5;
    await trackEl.updateComplete;
    expect(volumeOf(editor, id)).toBe(0.5);
    expect(panOf(editor, id)).toBe(-0.5);

    engine.undo();
    expect(volumeOf(editor, id)).toBe(0.8);
    expect(panOf(editor, id)).toBe(0);
    expect(engine.canUndo).toBe(false);
  });

  it('two updates of the element are two steps', async () => {
    const { editor } = await makeEditor();
    const trackEl = await editor.addTrack(midiTrackConfig('A', 0.8));
    const id: string = trackEl.trackId;
    const engine = editor.engine;

    trackEl.volume = 0.5;
    await trackEl.updateComplete;
    trackEl.pan = -0.5;
    await trackEl.updateComplete;

    engine.undo();
    expect(volumeOf(editor, id)).toBe(0.5);
    expect(panOf(editor, id)).toBe(0);
    expect(engine.canUndo).toBe(true);
  });

  it('editor.updateTrack(id, { volume, pan }) is one step, with an element', async () => {
    const { editor } = await makeEditor();
    const trackEl = await editor.addTrack(midiTrackConfig('A', 0.8));
    const id: string = trackEl.trackId;
    const engine = editor.engine;

    editor.updateTrack(id, { volume: 0.5, pan: 0.25 });
    await trackEl.updateComplete;
    expect(volumeOf(editor, id)).toBe(0.5);
    expect(panOf(editor, id)).toBe(0.25);

    engine.undo();
    expect(volumeOf(editor, id)).toBe(0.8);
    expect(panOf(editor, id)).toBe(0);
    expect(engine.canUndo).toBe(false);
  });

  it('editor.updateTrack(id, { volume, pan }) is one step, without an element', async () => {
    const { editor } = await makeEditor();
    const trackEl = await editor.addTrack(midiTrackConfig('A', 0.8));
    const id: string = trackEl.trackId;
    const engine = editor.engine;
    // As a file drop: a track the editor holds with no <daw-track>.
    editor._trackElements.delete(id);

    editor.updateTrack(id, { volume: 0.5, pan: 0.25 });
    expect(volumeOf(editor, id)).toBe(0.5);
    expect(panOf(editor, id)).toBe(0.25);

    engine.undo();
    expect(volumeOf(editor, id)).toBe(0.8);
    expect(panOf(editor, id)).toBe(0);
    expect(engine.canUndo).toBe(false);
  });

  it('editor.updateTrack on a loading track without an element changes the seed, not the history', async () => {
    const { editor } = await makeEditor();
    stubPeakPipeline(editor);
    const engine = await editor.ready();
    let releaseDecode!: (b: AudioBuffer) => void;
    editor._fetchAndDecode = vi.fn(
      () =>
        new Promise<AudioBuffer>((resolve) => {
          releaseDecode = resolve;
        })
    );
    const setVolume = vi.spyOn(engine, 'setTrackVolume');
    const pending = editor.addTrack({ name: 'B', volume: 0.8, clips: [{ src: '/b.opus' }] });
    await vi.waitFor(() => expect(editor._fetchAndDecode).toHaveBeenCalled());
    const id = [...editor._tracks.keys()][0] as string;
    editor._trackElements.delete(id);

    editor.updateTrack(id, { volume: 0.3, pan: 0.5 });
    expect(setVolume).not.toHaveBeenCalled();
    expect(editor._seedMix.get(id)).toMatchObject({ volume: 0.3, pan: 0.5 });

    releaseDecode(makeAudioBuffer());
    await pending;
    expect(volumeOf(editor, id)).toBe(0.3);
    expect(panOf(editor, id)).toBe(0.5);
    expect(engine.canUndo).toBe(false);
  });
});

// #843: <daw-track-controls> sends one gesture id per slider drag, and the
// editor passes it to the engine setter, so a drag (or a key press) is one
// undo step. A mute or solo click is a step of its own.
describe('<daw-editor> control gestures (#843)', () => {
  function mixOf(editor: any, id: string): any {
    return editor.engine.getState().tracks.find((t: any) => t.id === id);
  }
  function slider(editor: any, id: string, which: 'volume' | 'pan'): HTMLInputElement {
    const inputs = controlsFor(editor, id).shadowRoot.querySelectorAll('input[type="range"]');
    return inputs[which === 'volume' ? 0 : 1];
  }
  function drag(input: HTMLInputElement, values: string[]) {
    for (const value of values) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  async function editorWithTrack() {
    const { editor } = await makeEditor();
    const trackEl = await editor.addTrack(midiTrackConfig('A', 0.8));
    await editor.updateComplete;
    return { editor, id: trackEl.trackId as string, engine: editor.engine };
  }

  it('a volume drag is one step', async () => {
    const { editor, id, engine } = await editorWithTrack();
    drag(slider(editor, id, 'volume'), ['0.7', '0.6', '0.5']);
    expect(mixOf(editor, id).volume).toBe(0.5);

    engine.undo();
    expect(mixOf(editor, id).volume).toBe(0.8);
    expect(engine.canUndo).toBe(false);
  });

  it('a key press on a slider is one step', async () => {
    const { editor, id, engine } = await editorWithTrack();
    const input = slider(editor, id, 'volume');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    input.value = '0.79';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    input.value = '0.78';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', bubbles: true }));
    expect(mixOf(editor, id).volume).toBe(0.78);

    engine.undo();
    expect(mixOf(editor, id).volume).toBe(0.8);
    expect(engine.canUndo).toBe(false);
  });

  it('volume then pan are two steps', async () => {
    const { editor, id, engine } = await editorWithTrack();
    drag(slider(editor, id, 'volume'), ['0.7', '0.5']);
    await editor.updateComplete;
    drag(slider(editor, id, 'pan'), ['0.1', '0.3']);
    expect(mixOf(editor, id)).toMatchObject({ volume: 0.5, pan: 0.3 });

    engine.undo();
    expect(mixOf(editor, id)).toMatchObject({ volume: 0.5, pan: 0 });
    engine.undo();
    expect(mixOf(editor, id)).toMatchObject({ volume: 0.8, pan: 0 });
    expect(engine.canUndo).toBe(false);
  });

  it('a mute click is one step', async () => {
    const { editor, id, engine } = await editorWithTrack();
    const muteButton = () =>
      controlsFor(editor, id).shadowRoot.querySelector('button[title="Mute"]') as HTMLElement;
    muteButton().click();
    await editor.updateComplete;
    await controlsFor(editor, id).updateComplete;
    muteButton().click();
    expect(mixOf(editor, id).muted).toBe(false);

    engine.undo();
    expect(mixOf(editor, id).muted).toBe(true);
    engine.undo();
    expect(mixOf(editor, id).muted).toBe(false);
    expect(engine.canUndo).toBe(false);
  });
});
