import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import type { DawEditorElement } from '../elements/daw-editor';
import type { DawTrackElement } from '../elements/daw-track';

const {
  ensureWamHost,
  createWamInstance,
  createWamInstanceFromFactory,
  createParameterPanel,
  createWamParameterPanel,
  createWamTransportBridge,
} = vi.hoisted(() => ({
  ensureWamHost: vi.fn(),
  createWamInstance: vi.fn(),
  createWamInstanceFromFactory: vi.fn(),
  createParameterPanel: vi.fn(),
  createWamParameterPanel: vi.fn(),
  createWamTransportBridge: vi.fn(() => ({
    notifyNodeAdded: vi.fn(),
    broadcastNow: vi.fn(),
    dispose: vi.fn(),
  })),
}));
const { compileFaustToWam } = vi.hoisted(() => ({ compileFaustToWam: vi.fn() }));

vi.mock('@dawcore/wam', () => ({
  ensureWamHost,
  createWamTransportBridge,
  createWamInstance,
  createWamInstanceFromFactory,
  createParameterPanel,
  createWamParameterPanel,
}));
vi.mock('@dawcore/faust', () => ({ compileFaustToWam }));

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
});

const PLUGIN_URL = 'https://plugins.example.com/reverb/index.js';
const FAUST_DSP = 'process = _;';

function mockGainNode() {
  return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
}

function makeMockPlugin(name = 'Mock Reverb') {
  const audioNode = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    setParameterValues: vi.fn().mockResolvedValue(undefined),
  };
  return {
    url: PLUGIN_URL,
    descriptor: { name, apiVersion: '2.0.0', hasAudioInput: true, hasAudioOutput: true },
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
let container: HTMLElement;

beforeEach(() => {
  vi.stubGlobal('devicePixelRatio', 1);
  ensureWamHost.mockReset().mockResolvedValue({ hostGroupId: 'group-1', hostGroupKey: 'key-1' });
  plugin = makeMockPlugin();
  factory = { createInstance: vi.fn() };
  createWamInstance.mockReset().mockResolvedValue(plugin);
  createWamInstanceFromFactory.mockReset().mockResolvedValue(plugin);
  compileFaustToWam
    .mockReset()
    .mockImplementation(async (code: string, opts?: { name?: string }) => ({
      factory,
      name: opts?.name ?? 'FaustDSP',
      dspCode: code,
    }));
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

describe('<daw-editor> per-track WAM/Faust/GUI API (by trackId)', () => {
  it('addTrackWamPlugin loads a WAM plugin into a track chain by id', async () => {
    const track = await appendTrack();

    const id = await editor.addTrackWamPlugin(track.trackId, PLUGIN_URL);

    expect(typeof id).toBe('string');
    expect(adapter.transport.connectTrackOutput).toHaveBeenCalledWith(
      track.trackId,
      expect.anything()
    );
    expect(editor.trackEffects(track.trackId)).toHaveLength(1);
    expect(editor.trackEffects(track.trackId)[0]).toMatchObject({
      kind: 'wam',
      label: 'Mock Reverb',
    });
    // Master chain untouched
    expect(editor.effects).toHaveLength(0);
  });

  it('addTrackWamPlugin dispatches daw-effect-add from the track element', async () => {
    const track = await appendTrack();
    const onAdd = vi.fn();
    editor.addEventListener('daw-effect-add', onAdd as EventListener);

    await editor.addTrackWamPlugin(track.trackId, PLUGIN_URL);

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect((onAdd.mock.calls[0][0] as Event).target).toBe(track);
  });

  it('addTrackFaustEffect compiles DSP and adds it to a track chain by id', async () => {
    const track = await appendTrack();

    const id = await editor.addTrackFaustEffect(track.trackId, FAUST_DSP, { name: 'My LP' });

    expect(typeof id).toBe('string');
    expect(compileFaustToWam).toHaveBeenCalledWith(
      FAUST_DSP,
      expect.objectContaining({ name: 'My LP' })
    );
    expect(editor.trackEffects(track.trackId)).toHaveLength(1);
    expect(editor.trackEffects(track.trackId)[0]).toMatchObject({
      kind: 'wam',
      source: { faust: FAUST_DSP },
    });
  });

  it('openTrackEffectGui mounts a per-track effect GUI by id; closeTrackEffectGui detaches it', async () => {
    const track = await appendTrack();
    const id = editor.addTrackEffect(track.trackId, 'native-gain');

    const element = await editor.openTrackEffectGui(track.trackId, id, container);

    expect(element.className).toBe('mock-native-panel');
    expect(container.contains(element)).toBe(true);

    editor.closeTrackEffectGui(track.trackId, id);
    expect(element.parentElement).toBeNull();
  });
});
