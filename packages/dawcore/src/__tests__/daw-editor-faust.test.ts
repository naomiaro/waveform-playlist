import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import type { DawEditorElement } from '../elements/daw-editor';
import type { DawTrackElement } from '../elements/daw-track';

const { ensureWamHost, createWamInstance, createWamInstanceFromFactory, createWamTransportBridge } =
  vi.hoisted(() => ({
    ensureWamHost: vi.fn(),
    createWamInstance: vi.fn(),
    createWamInstanceFromFactory: vi.fn(),
    createWamTransportBridge: vi.fn(() => ({
      notifyNodeAdded: vi.fn(),
      broadcastNow: vi.fn(),
      dispose: vi.fn(),
    })),
  }));

const { compileFaustToWam } = vi.hoisted(() => ({
  compileFaustToWam: vi.fn(),
}));

vi.mock('@dawcore/wam', () => ({
  ensureWamHost,
  createWamInstance,
  createWamInstanceFromFactory,
  createWamTransportBridge,
}));

vi.mock('@dawcore/faust', () => ({ compileFaustToWam }));

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
});

const LOWPASS_DSP =
  'import("stdfaust.lib");\n' +
  'cutoff = hslider("cutoff", 1000, 20, 20000, 1);\n' +
  'process = fi.lowpass(2, cutoff), fi.lowpass(2, cutoff);\n';

function mockGainNode() {
  return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
}

/** A factory-created plugin instance: NO url (mirrors createWamInstanceFromFactory). */
function makeMockPlugin(name = 'Stereo Lowpass') {
  const audioNode = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    setParameterValues: vi.fn().mockResolvedValue(undefined),
  };
  return {
    descriptor: {
      name,
      apiVersion: '2.0.0',
      hasAudioInput: true,
      hasAudioOutput: true,
    },
    audioNode,
    getState: vi.fn().mockResolvedValue({}),
    setState: vi.fn().mockResolvedValue(undefined),
    getParameterInfo: vi.fn().mockResolvedValue({}),
    destroy: vi.fn(),
  };
}

function makeMockAdapter() {
  const ctx = {
    sampleRate: 48000,
    state: 'running' as AudioContextState,
    destination: { connect: vi.fn(), disconnect: vi.fn() },
    createGain: vi.fn(() => mockGainNode()),
    resume: vi.fn().mockResolvedValue(undefined),
    decodeAudioData: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const transport = {
    connectTrackOutput: vi.fn(),
    disconnectTrackOutput: vi.fn(),
    connectMasterOutput: vi.fn(),
    disconnectMasterOutput: vi.fn(),
    masterOutputNode: mockGainNode(),
  };
  return {
    audioContext: ctx as unknown as AudioContext,
    ppqn: 960,
    transport,
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

let editor: DawEditorElement;
let adapter: ReturnType<typeof makeMockAdapter>;
let plugin: ReturnType<typeof makeMockPlugin>;
let factory: { createInstance: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.stubGlobal('devicePixelRatio', 1);
  ensureWamHost.mockReset().mockResolvedValue({ hostGroupId: 'group-1', hostGroupKey: 'key-1' });
  plugin = makeMockPlugin();
  factory = { createInstance: vi.fn() };
  compileFaustToWam
    .mockReset()
    .mockImplementation(async (code: string, opts?: { name?: string }) => ({
      factory,
      name: opts?.name ?? 'FaustDSP',
      dspCode: code,
    }));
  createWamInstanceFromFactory.mockReset().mockResolvedValue(plugin);
  createWamInstance.mockReset();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor = document.createElement('daw-editor') as any;
  adapter = makeMockAdapter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (editor as any).adapter = adapter;
  document.body.appendChild(editor);
});

afterEach(() => {
  editor.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function appendTrack(): Promise<DawTrackElement> {
  const track = document.createElement('daw-track') as DawTrackElement;
  editor.appendChild(track);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return track;
}

describe('addFaustEffect', () => {
  it('compiles the DSP and instantiates the factory into the track chain', async () => {
    const track = await appendTrack();
    const id = await track.addFaustEffect(LOWPASS_DSP);

    expect(typeof id).toBe('string');
    expect(compileFaustToWam).toHaveBeenCalledWith(
      LOWPASS_DSP,
      expect.objectContaining({ name: undefined })
    );
    expect(ensureWamHost).toHaveBeenCalledWith(adapter.audioContext);
    expect(createWamInstanceFromFactory).toHaveBeenCalledWith(
      factory,
      adapter.audioContext,
      'group-1',
      expect.objectContaining({ initialState: undefined })
    );
    // No URL-based loading anywhere in the Faust path.
    expect(createWamInstance).not.toHaveBeenCalled();
    expect(track.effects).toHaveLength(1);
    expect(track.effects[0]).toMatchObject({
      kind: 'wam',
      label: 'Stereo Lowpass',
      source: { faust: LOWPASS_DSP },
      bypassed: false,
    });
    expect(track.effects[0].url).toBeUndefined();
  });

  it('adds to the master chain on <daw-editor>', async () => {
    const id = await editor.addFaustEffect(LOWPASS_DSP);

    expect(adapter.transport.connectMasterOutput).toHaveBeenCalledTimes(1);
    expect(editor.effects[0]).toMatchObject({
      id,
      kind: 'wam',
      source: { faust: LOWPASS_DSP },
    });
  });

  it('forwards the name option to the compiler', async () => {
    await editor.addFaustEffect(LOWPASS_DSP, { name: 'My LP' });

    expect(compileFaustToWam).toHaveBeenCalledWith(
      LOWPASS_DSP,
      expect.objectContaining({ name: 'My LP' })
    );
  });

  it('a Faust compile error propagates with its diagnostics and leaves the chain untouched', async () => {
    const faustError = new Error('lowpass.dsp : 2 : ERROR : undefined symbol : fi.lowpasss');
    compileFaustToWam.mockReset().mockRejectedValue(faustError);

    await expect(editor.addFaustEffect('process = fi.lowpasss(2);')).rejects.toBe(faustError);

    expect(editor.effects).toHaveLength(0);
    // Compilation happens BEFORE any host/chain work.
    expect(ensureWamHost).not.toHaveBeenCalled();
    expect(createWamInstanceFromFactory).not.toHaveBeenCalled();
  });

  it('dispatches daw-effect-add with the faust source, bubbling to the editor', async () => {
    const track = await appendTrack();
    const onAdd = vi.fn();
    editor.addEventListener('daw-effect-add', onAdd as EventListener);

    const id = await track.addFaustEffect(LOWPASS_DSP);

    expect(onAdd).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((onAdd.mock.calls[0][0] as any).detail).toMatchObject({
      effectId: id,
      kind: 'wam',
      source: { faust: LOWPASS_DSP },
      index: 0,
    });
  });

  it('participates in chain ops like any WAM entry (params, bypass, remove)', async () => {
    const track = await appendTrack();
    const id = await track.addFaustEffect(LOWPASS_DSP);

    track.setEffectParams(id, { cutoff: 250 });
    expect(plugin.audioNode.setParameterValues).toHaveBeenCalledWith({
      cutoff: { id: 'cutoff', value: 250, normalized: false },
    });

    track.setEffectBypassed(id, true);
    expect(track.effects[0].bypassed).toBe(true);

    track.removeEffect(id);
    expect(plugin.destroy).toHaveBeenCalledTimes(1);
    expect(track.effects).toHaveLength(0);
  });

  it('destroys the plugin when the chain is disposed while the DSP is compiling', async () => {
    const track = await appendTrack();
    let resolveCompile!: (v: unknown) => void;
    compileFaustToWam.mockReset().mockReturnValue(
      new Promise((resolve) => {
        resolveCompile = resolve;
      })
    );

    const pending = track.addFaustEffect(LOWPASS_DSP);
    track.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));
    resolveCompile({ factory, name: 'FaustDSP', dspCode: LOWPASS_DSP });

    await expect(pending).rejects.toThrow(/disposed/i);
    expect(plugin.destroy).toHaveBeenCalledTimes(1);
  });

  it('rejects empty DSP code without compiling', async () => {
    await expect(editor.addFaustEffect('   ')).rejects.toThrow(/non-empty string/);
    expect(compileFaustToWam).not.toHaveBeenCalled();
  });
});

describe('Faust persistence', () => {
  it('serializes a Faust entry with its DSP source and name — no url', async () => {
    plugin.getState.mockResolvedValue({ '/Stereo Lowpass/cutoff': 500 });
    await editor.addFaustEffect(LOWPASS_DSP, { name: 'My LP' });

    const state = await editor.getEffectsState();

    expect(state).toHaveLength(1);
    expect(state[0]).toMatchObject({
      kind: 'wam',
      faustDsp: LOWPASS_DSP,
      bypassed: false,
      state: { '/Stereo Lowpass/cutoff': 500 },
    });
    expect('url' in state[0]).toBe(false);
  });

  it('round-trips the compile name through faustName', async () => {
    // The label (and therefore faustName) comes from the compiled descriptor.
    await editor.addFaustEffect(LOWPASS_DSP, { name: 'My LP' });

    const state = await editor.getEffectsState();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((state[0] as any).faustName).toBe('Stereo Lowpass');
  });

  it('setEffectsState recompiles faustDsp entries and applies the saved state', async () => {
    const saved = [
      {
        kind: 'wam' as const,
        faustDsp: LOWPASS_DSP,
        faustName: 'My LP',
        bypassed: false,
        state: { '/My LP/cutoff': 500 },
      },
    ];

    await editor.setEffectsState(saved);

    expect(compileFaustToWam).toHaveBeenCalledWith(
      LOWPASS_DSP,
      expect.objectContaining({ name: 'My LP' })
    );
    expect(createWamInstanceFromFactory).toHaveBeenCalledWith(
      factory,
      adapter.audioContext,
      'group-1',
      expect.objectContaining({ initialState: { '/My LP/cutoff': 500 } })
    );
    expect(editor.effects).toHaveLength(1);
    expect(editor.effects[0]).toMatchObject({ kind: 'wam', source: { faust: LOWPASS_DSP } });
  });

  it('restores bypassed Faust entries as bypassed', async () => {
    await editor.setEffectsState([{ kind: 'wam', faustDsp: LOWPASS_DSP, bypassed: true }]);

    expect(editor.effects[0].bypassed).toBe(true);
  });

  it('a failed recompile becomes a placeholder, fires daw-effect-error, and round-trips', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    compileFaustToWam
      .mockReset()
      .mockRejectedValue(new Error('lowpass.dsp : 1 : ERROR : syntax error'));
    const onError = vi.fn();
    editor.addEventListener('daw-effect-error', onError as EventListener);
    const saved = [
      {
        kind: 'wam' as const,
        faustDsp: LOWPASS_DSP,
        faustName: 'My LP',
        bypassed: false,
        state: { '/My LP/cutoff': 500 },
      },
    ];

    await editor.setEffectsState(saved);

    expect(onError).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((onError.mock.calls[0][0] as any).detail.message).toContain('syntax error');
    expect(editor.effects).toHaveLength(1);
    expect(editor.effects[0].error).toContain('syntax error');

    // Re-serialization keeps the saved DSP + state for a later retry.
    const reserialized = await editor.getEffectsState();
    expect(reserialized[0]).toMatchObject({
      kind: 'wam',
      faustDsp: LOWPASS_DSP,
      bypassed: false,
      state: { '/My LP/cutoff': 500 },
    });
    expect(warn).toHaveBeenCalled();
  });

  it('rejects a wam entry with neither url nor faustDsp', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.setEffectsState([{ kind: 'wam', bypassed: false } as any])
    ).rejects.toThrow(/url.*faustDsp|faustDsp.*url/);
  });

  it('still accepts url-based wam entries (regression)', async () => {
    const urlPlugin = makeMockPlugin('URL Reverb');
    createWamInstance.mockResolvedValue({
      ...urlPlugin,
      url: 'https://plugins.example.com/reverb/index.js',
    });

    await editor.setEffectsState([
      { kind: 'wam', url: 'https://plugins.example.com/reverb/index.js', bypassed: false },
    ]);

    expect(createWamInstance).toHaveBeenCalledTimes(1);
    expect(editor.effects[0]).toMatchObject({
      kind: 'wam',
      url: 'https://plugins.example.com/reverb/index.js',
    });
  });
});
