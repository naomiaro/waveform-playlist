import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-editor');
});

beforeEach(() => {
  vi.stubGlobal('devicePixelRatio', 1);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.querySelectorAll('daw-editor').forEach((e) => e.remove());
});

function makeMockAdapter() {
  // Minimal PlayoutAdapter stub — engine accepts but doesn't actually play.
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

async function makeEditor(opts: { callbacks?: boolean } = {}) {
  const editor = document.createElement('daw-editor') as any;
  const adapter = makeMockAdapter();
  editor.adapter = adapter;
  if (opts.callbacks) {
    // Both callbacks present = external tempo map is authoritative
    editor.secondsToTicks = (s: number) => Math.round((s * 120 * 960) / 60);
    editor.ticksToSeconds = (t: number) => (t * 60) / (120 * 960);
  }
  document.body.appendChild(editor);
  await editor.ready(); // builds the engine without tracks
  return { editor, adapter };
}

describe('<daw-editor> bpm tempo forwarding (#407)', () => {
  it('forwards bpm to the adapter when no tick callbacks are set', async () => {
    const { editor, adapter } = await makeEditor();
    adapter.setTempo.mockClear();

    editor.bpm = 140;

    expect(adapter.setTempo).toHaveBeenCalledWith(140, undefined);
  });

  it('is display-only when both tick callbacks are set', async () => {
    const { editor, adapter } = await makeEditor({ callbacks: true });
    adapter.setTempo.mockClear();

    editor.bpm = 140;

    expect(adapter.setTempo).not.toHaveBeenCalled();
    expect(editor.bpm).toBe(140); // readout still updates
  });

  it('is display-only when both callbacks are assigned after the engine is built', async () => {
    // Realistic variable-tempo order: build editor → analyze audio → install
    // callbacks → set bpm readout. _hasTickCallbacks must be a live check,
    // not a build-time snapshot.
    const { editor, adapter } = await makeEditor();
    editor.secondsToTicks = (s: number) => Math.round((s * 120 * 960) / 60);
    editor.ticksToSeconds = (t: number) => (t * 60) / (120 * 960);
    adapter.setTempo.mockClear();

    editor.bpm = 140;

    expect(adapter.setTempo).not.toHaveBeenCalled();
    expect(editor.bpm).toBe(140);
  });

  it('still forwards when only one callback is set (both required)', async () => {
    const { editor, adapter } = await makeEditor();
    editor.secondsToTicks = (s: number) => Math.round((s * 120 * 960) / 60);
    adapter.setTempo.mockClear();

    editor.bpm = 140;

    expect(adapter.setTempo).toHaveBeenCalledWith(140, undefined);
  });

  it('skips the initial engine-build setTempo forward when callbacks are set', async () => {
    const { adapter } = await makeEditor({ callbacks: true });

    expect(adapter.setTempo).not.toHaveBeenCalled();
  });

  it('forwards the initial bpm at engine build without callbacks', async () => {
    const { adapter } = await makeEditor();

    expect(adapter.setTempo).toHaveBeenCalledWith(120);
  });
});
