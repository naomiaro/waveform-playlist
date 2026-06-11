import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import type { DawEditorElement } from '../elements/daw-editor';
import type { DawTrackElement } from '../elements/daw-track';

const {
  ensureWamHost,
  createWamInstance,
  createParameterPanel,
  createWamParameterPanel,
  createWamTransportBridge,
} = vi.hoisted(() => ({
  ensureWamHost: vi.fn(),
  createWamInstance: vi.fn(),
  createParameterPanel: vi.fn(),
  createWamParameterPanel: vi.fn(),
  createWamTransportBridge: vi.fn(() => ({
    notifyNodeAdded: vi.fn(),
    broadcastNow: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('@dawcore/wam', () => ({
  ensureWamHost,
  createWamTransportBridge,
  createWamInstance,
  createParameterPanel,
  createWamParameterPanel,
}));

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
});

const PLUGIN_URL = 'https://plugins.example.com/reverb/index.js';

function mockGainNode() {
  return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
}

function makeMockPlugin({ withGui = true }: { withGui?: boolean } = {}) {
  const guiElement = document.createElement('div');
  guiElement.className = 'mock-plugin-gui';
  const audioNode = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    setParameterValues: vi.fn().mockResolvedValue(undefined),
  };
  return {
    url: PLUGIN_URL,
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
    ...(withGui ? { createGui: vi.fn().mockResolvedValue(guiElement), destroyGui: vi.fn() } : {}),
    guiElement,
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
let container: HTMLElement;

beforeEach(() => {
  vi.stubGlobal('devicePixelRatio', 1);
  ensureWamHost.mockReset().mockResolvedValue({ hostGroupId: 'group-1', hostGroupKey: 'key-1' });
  plugin = makeMockPlugin();
  createWamInstance.mockReset().mockResolvedValue(plugin);
  createParameterPanel.mockReset().mockImplementation(() => {
    const el = document.createElement('div');
    el.className = 'mock-native-panel';
    return el;
  });
  createWamParameterPanel.mockReset().mockImplementation(async () => {
    const el = document.createElement('div');
    el.className = 'mock-wam-panel';
    return el;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor = document.createElement('daw-editor') as any;
  adapter = makeMockAdapter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (editor as any).adapter = adapter;
  document.body.appendChild(editor);
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  editor.remove();
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function appendTrack(): Promise<DawTrackElement> {
  const track = document.createElement('daw-track') as DawTrackElement;
  editor.appendChild(track);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return track;
}

describe('openEffectGui / closeEffectGui — WAM plugin GUI', () => {
  it('creates the GUI lazily: not on add, once on first open, mounted in the container', async () => {
    const track = await appendTrack();
    const id = await track.addWamPlugin(PLUGIN_URL);
    expect(plugin.createGui).not.toHaveBeenCalled();

    const element = await track.openEffectGui(id, container);

    expect(plugin.createGui).toHaveBeenCalledTimes(1);
    expect(element).toBe(plugin.guiElement);
    expect(container.contains(element)).toBe(true);
  });

  it('close hides (detaches) without destroying the GUI or the audio', async () => {
    const track = await appendTrack();
    const id = await track.addWamPlugin(PLUGIN_URL);
    await track.openEffectGui(id, container);

    track.closeEffectGui(id);

    expect(plugin.guiElement.parentElement).toBeNull();
    expect(plugin.destroyGui).not.toHaveBeenCalled();
    expect(plugin.destroy).not.toHaveBeenCalled();
  });

  it('reopen reuses the cached element — createGui is never called twice', async () => {
    const track = await appendTrack();
    const id = await track.addWamPlugin(PLUGIN_URL);
    await track.openEffectGui(id, container);
    track.closeEffectGui(id);

    const element = await track.openEffectGui(id, container);

    expect(plugin.createGui).toHaveBeenCalledTimes(1);
    expect(element).toBe(plugin.guiElement);
    expect(container.contains(element)).toBe(true);
  });

  it('reopening into a different container moves the cached element', async () => {
    const track = await appendTrack();
    const id = await track.addWamPlugin(PLUGIN_URL);
    await track.openEffectGui(id, container);
    const other = document.createElement('div');
    document.body.appendChild(other);

    await track.openEffectGui(id, other);

    expect(other.contains(plugin.guiElement)).toBe(true);
    expect(container.contains(plugin.guiElement)).toBe(false);
    other.remove();
  });

  it('works for the master chain on <daw-editor>', async () => {
    const id = await editor.addWamPlugin(PLUGIN_URL);

    const element = await editor.openEffectGui(id, container);
    expect(container.contains(element)).toBe(true);

    editor.closeEffectGui(id);
    expect(element.parentElement).toBeNull();
  });
});

describe('openEffectGui — generic parameter panel fallback', () => {
  it('renders the WAM parameter panel when the plugin has no createGui', async () => {
    plugin = makeMockPlugin({ withGui: false });
    createWamInstance.mockReset().mockResolvedValue(plugin);
    const track = await appendTrack();
    const id = await track.addWamPlugin(PLUGIN_URL);

    const element = await track.openEffectGui(id, container);

    expect(createWamParameterPanel).toHaveBeenCalledTimes(1);
    expect(element.className).toBe('mock-wam-panel');
    expect(container.contains(element)).toBe(true);
    // The node-like handed to the panel proxies the plugin's parameter info.
    const nodeLike = createWamParameterPanel.mock.calls[0][0];
    await nodeLike.getParameterInfo();
    expect(plugin.getParameterInfo).toHaveBeenCalled();
  });

  it('falls back (with a warning) when the plugin createGui throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    plugin.createGui!.mockRejectedValueOnce(new Error('gui exploded'));
    const track = await appendTrack();
    const id = await track.addWamPlugin(PLUGIN_URL);

    const element = await track.openEffectGui(id, container);

    expect(element.className).toBe('mock-wam-panel');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('gui exploded'));
  });

  it('panel edits route through setParameterValues and dispatch daw-effect-change', async () => {
    plugin = makeMockPlugin({ withGui: false });
    createWamInstance.mockReset().mockResolvedValue(plugin);
    const track = await appendTrack();
    const id = await track.addWamPlugin(PLUGIN_URL);
    const onChange = vi.fn();
    editor.addEventListener('daw-effect-change', onChange as EventListener);
    await track.openEffectGui(id, container);

    const options = createWamParameterPanel.mock.calls[0][1];
    options.onParamChange('cutoff', 1000);

    expect(plugin.audioNode.setParameterValues).toHaveBeenCalledWith({
      cutoff: { id: 'cutoff', value: 1000, normalized: false },
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((onChange.mock.calls[0][0] as any).detail).toMatchObject({
      effectId: id,
      params: { cutoff: 1000 },
    });
  });

  it('renders the same generic panel for native entries from registry metadata', async () => {
    const track = await appendTrack();
    const id = track.addEffect('native-gain');

    const element = await track.openEffectGui(id, container);

    expect(element.className).toBe('mock-native-panel');
    expect(container.contains(element)).toBe(true);
    const params = createParameterPanel.mock.calls[0][0];
    expect(params).toEqual([{ id: 'gain', min: 0, max: 2, step: 0.01, value: 1 }]);
  });

  it('native panel edits update chain params and dispatch daw-effect-change', async () => {
    const track = await appendTrack();
    const id = track.addEffect('native-gain');
    const onChange = vi.fn();
    editor.addEventListener('daw-effect-change', onChange as EventListener);
    await track.openEffectGui(id, container);

    const panelOnChange = createParameterPanel.mock.calls[0][1];
    panelOnChange('gain', 1.5);

    expect(track.effects[0].params.gain).toBe(1.5);
    expect(onChange).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((onChange.mock.calls[0][0] as any).detail).toMatchObject({
      effectId: id,
      params: { gain: 1.5 },
    });
  });

  it('native panels seed slider values from the current params, not the defaults', async () => {
    const track = await appendTrack();
    const id = track.addEffect('native-gain', { gain: 0.5 });

    await track.openEffectGui(id, container);

    const params = createParameterPanel.mock.calls[0][0];
    expect(params[0].value).toBe(0.5);
  });
});

describe('GUI destruction on removal', () => {
  it('removeEffect with an open GUI detaches it and calls destroyGui without errors', async () => {
    const track = await appendTrack();
    const id = await track.addWamPlugin(PLUGIN_URL);
    await track.openEffectGui(id, container);

    track.removeEffect(id);

    expect(plugin.guiElement.parentElement).toBeNull();
    expect(plugin.destroyGui).toHaveBeenCalledWith(plugin.guiElement);
    expect(plugin.destroy).toHaveBeenCalledTimes(1);
    await expect(track.openEffectGui(id, container)).rejects.toThrow(/unknown effectId/i);
  });

  it('removing the track with an open GUI destroys the GUI', async () => {
    const track = await appendTrack();
    const id = await track.addWamPlugin(PLUGIN_URL);
    await track.openEffectGui(id, container);

    track.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(plugin.guiElement.parentElement).toBeNull();
    expect(plugin.destroyGui).toHaveBeenCalledWith(plugin.guiElement);
  });

  it('disconnecting the editor destroys open master-chain GUIs', async () => {
    const id = await editor.addWamPlugin(PLUGIN_URL);
    await editor.openEffectGui(id, container);

    editor.remove();

    expect(plugin.guiElement.parentElement).toBeNull();
    expect(plugin.destroyGui).toHaveBeenCalledWith(plugin.guiElement);
  });

  it('an effect removed while its GUI is still loading discards the late GUI', async () => {
    const track = await appendTrack();
    const id = await track.addWamPlugin(PLUGIN_URL);
    let resolveGui!: (el: HTMLElement) => void;
    plugin.createGui!.mockReturnValueOnce(
      new Promise<HTMLElement>((resolve) => {
        resolveGui = resolve;
      })
    );

    const pending = track.openEffectGui(id, container);
    track.removeEffect(id);
    resolveGui(plugin.guiElement);

    await expect(pending).rejects.toThrow(/removed/i);
    expect(plugin.destroyGui).toHaveBeenCalledWith(plugin.guiElement);
    expect(container.contains(plugin.guiElement)).toBe(false);
  });
});

describe('error handling', () => {
  it('openEffectGui rejects on an unknown effectId', async () => {
    const track = await appendTrack();
    await expect(track.openEffectGui('effect-nope', container)).rejects.toThrow(
      /unknown effectId/i
    );
    await expect(editor.openEffectGui('effect-nope', container)).rejects.toThrow(
      /unknown effectId/i
    );
  });

  it('openEffectGui rejects when the container is not a DOM element', async () => {
    const track = await appendTrack();
    const id = track.addEffect('native-gain');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(track.openEffectGui(id, null as any)).rejects.toThrow(/container/i);
  });

  it('closeEffectGui on a never-opened effect warns and does not throw', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const track = await appendTrack();
    const id = track.addEffect('native-gain');

    expect(() => track.closeEffectGui(id)).not.toThrow();
    expect(() => editor.closeEffectGui('effect-nope')).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[waveform-playlist]'));
  });
});
