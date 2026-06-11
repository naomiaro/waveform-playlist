import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import type { DawEditorElement } from '../elements/daw-editor';
import type { DawTrackElement } from '../elements/daw-track';

const { ensureWamHost, createWamInstance, createWamTransportBridge } = vi.hoisted(() => ({
  ensureWamHost: vi.fn(),
  createWamInstance: vi.fn(),
  createWamTransportBridge: vi.fn(() => ({
    notifyNodeAdded: vi.fn(),
    broadcastNow: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('@dawcore/wam', () => ({ ensureWamHost, createWamInstance, createWamTransportBridge }));

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
});

const PLUGIN_URL = 'https://plugins.example.com/reverb/index.js';

function mockGainNode() {
  return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
}

function makeMockPlugin(url = PLUGIN_URL) {
  const audioNode = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    setParameterValues: vi.fn().mockResolvedValue(undefined),
  };
  return {
    url,
    descriptor: {
      name: 'Mock Reverb',
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

beforeEach(() => {
  vi.stubGlobal('devicePixelRatio', 1);
  ensureWamHost.mockReset().mockResolvedValue({ hostGroupId: 'group-1', hostGroupKey: 'key-1' });
  plugin = makeMockPlugin();
  createWamInstance.mockReset().mockResolvedValue(plugin);
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

describe('addWamPlugin', () => {
  it('loads, instantiates, and adds the plugin to the track chain', async () => {
    const track = await appendTrack();
    const id = await track.addWamPlugin(PLUGIN_URL);

    expect(typeof id).toBe('string');
    expect(ensureWamHost).toHaveBeenCalledWith(adapter.audioContext);
    expect(createWamInstance).toHaveBeenCalledWith(PLUGIN_URL, adapter.audioContext, 'group-1', {
      initialState: undefined,
    });
    expect(track.effects).toHaveLength(1);
    expect(track.effects[0]).toMatchObject({
      kind: 'wam',
      url: PLUGIN_URL,
      label: 'Mock Reverb',
      bypassed: false,
    });
    // The chain wired the plugin's audioNode into the series.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gains = (adapter.audioContext.createGain as any).mock.results.map(
      (r: { value: ReturnType<typeof mockGainNode> }) => r.value
    );
    const wiredToPlugin = gains.some((g: ReturnType<typeof mockGainNode>) =>
      g.connect.mock.calls.some((c: unknown[]) => c[0] === plugin.audioNode)
    );
    expect(wiredToPlugin).toBe(true);
  });

  it('adds to the master chain on <daw-editor>', async () => {
    const id = await editor.addWamPlugin(PLUGIN_URL);

    expect(adapter.transport.connectMasterOutput).toHaveBeenCalledTimes(1);
    expect(editor.effects[0]).toMatchObject({ id, kind: 'wam', url: PLUGIN_URL });
  });

  it('forwards initialState to createWamInstance', async () => {
    const state = { preset: 'hall' };
    await editor.addWamPlugin(PLUGIN_URL, state);

    expect(createWamInstance).toHaveBeenCalledWith(PLUGIN_URL, adapter.audioContext, 'group-1', {
      initialState: state,
    });
  });

  it('dispatches daw-effect-add with kind and url, bubbling to the editor', async () => {
    const track = await appendTrack();
    const onAdd = vi.fn();
    editor.addEventListener('daw-effect-add', onAdd as EventListener);

    const id = await track.addWamPlugin(PLUGIN_URL);

    expect(onAdd).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((onAdd.mock.calls[0][0] as any).detail).toMatchObject({
      effectId: id,
      kind: 'wam',
      url: PLUGIN_URL,
      index: 0,
    });
  });

  it('removeEffect on a WAM entry destroys the plugin instance', async () => {
    const track = await appendTrack();
    const id = await track.addWamPlugin(PLUGIN_URL);

    track.removeEffect(id);

    expect(plugin.destroy).toHaveBeenCalledTimes(1);
    expect(track.effects).toHaveLength(0);
  });

  it('setEffectParams translates the flat record into setParameterValues', async () => {
    const track = await appendTrack();
    const id = await track.addWamPlugin(PLUGIN_URL);

    track.setEffectParams(id, { cutoff: 1000, resonance: 0.5 });

    expect(plugin.audioNode.setParameterValues).toHaveBeenCalledWith({
      cutoff: { id: 'cutoff', value: 1000, normalized: false },
      resonance: { id: 'resonance', value: 0.5, normalized: false },
    });
  });

  it('bypass removes the WAM node from the series and unbypass restores it', async () => {
    const track = await appendTrack();
    const id = await track.addWamPlugin(PLUGIN_URL);

    track.setEffectBypassed(id, true);
    expect(track.effects[0].bypassed).toBe(true);
    // The node was disconnected from the series (disconnection-style bypass).
    expect(plugin.audioNode.disconnect).toHaveBeenCalled();

    track.setEffectBypassed(id, false);
    expect(track.effects[0].bypassed).toBe(false);
  });

  it('destroys the plugin when the chain is disposed while the plugin is loading', async () => {
    const track = await appendTrack();
    let resolveInstance!: (p: ReturnType<typeof makeMockPlugin>) => void;
    createWamInstance.mockReset().mockReturnValue(
      new Promise((resolve) => {
        resolveInstance = resolve;
      })
    );

    const pending = track.addWamPlugin(PLUGIN_URL);
    // Track removed (chain disposed) while createWamInstance is in flight.
    track.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));
    resolveInstance(plugin);

    await expect(pending).rejects.toThrow(/disposed/i);
    expect(plugin.destroy).toHaveBeenCalledTimes(1);
    expect(track.effects).toHaveLength(0);
  });

  it('destroys the plugin if chain insertion throws after instantiation', async () => {
    const track = await appendTrack();
    const { EffectsChainController } = await import('../effects/effects-chain-controller');
    const addSpy = vi.spyOn(EffectsChainController.prototype, 'add').mockImplementation(() => {
      throw new Error('connect exploded');
    });

    try {
      await expect(track.addWamPlugin(PLUGIN_URL)).rejects.toThrow('connect exploded');
      expect(plugin.destroy).toHaveBeenCalledTimes(1);
    } finally {
      addSpy.mockRestore();
    }
  });

  it('a rejected setParameterValues is warned, not an unhandled rejection', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const track = await appendTrack();
    const id = await track.addWamPlugin(PLUGIN_URL);
    plugin.audioNode.setParameterValues.mockRejectedValueOnce(new Error('param refused'));

    track.setEffectParams(id, { cutoff: 1000 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('param refused'));
  });

  it('mixed native + WAM chains preserve order across moves', async () => {
    const track = await appendTrack();
    const native = track.addEffect('native-gain');
    const wam = await track.addWamPlugin(PLUGIN_URL);

    track.moveEffect(wam, 0);

    expect(track.effects.map((e) => e.id)).toEqual([wam, native]);
    expect(track.effects.map((e) => e.kind)).toEqual(['wam', 'native']);
  });
});
