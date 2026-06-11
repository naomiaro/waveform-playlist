import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import type { DawEditorElement } from '../elements/daw-editor';

const { ensureWamHost, createWamInstance, createWamTransportBridge, bridge } = vi.hoisted(() => {
  const bridge = { notifyNodeAdded: vi.fn(), broadcastNow: vi.fn(), dispose: vi.fn() };
  return {
    bridge,
    ensureWamHost: vi.fn(),
    createWamInstance: vi.fn(),
    createWamTransportBridge: vi.fn(() => bridge),
  };
});

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

function makeMockPlugin() {
  return {
    url: PLUGIN_URL,
    descriptor: {
      name: 'Mock Reverb',
      apiVersion: '2.0.0',
      hasAudioInput: true,
      hasAudioOutput: true,
    },
    audioNode: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      scheduleEvents: vi.fn(),
      setParameterValues: vi.fn().mockResolvedValue(undefined),
    },
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
    currentTime: 0,
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
    // Query/event surface the wam-transport bridge needs:
    audioContext: ctx,
    isPlaying: vi.fn().mockReturnValue(false),
    getCurrentTime: vi.fn().mockReturnValue(0),
    getTempo: vi.fn().mockReturnValue(120),
    getMeter: vi.fn().mockReturnValue({ numerator: 4, denominator: 4 }),
    timeToTick: vi.fn().mockReturnValue(0),
    tickToTime: vi.fn().mockReturnValue(0),
    tickToBar: vi.fn().mockReturnValue(1),
    barToTick: vi.fn().mockReturnValue(0),
    on: vi.fn(),
    off: vi.fn(),
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
  createWamTransportBridge.mockClear();
  bridge.notifyNodeAdded.mockClear();
  bridge.dispose.mockClear();
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

describe('wam-transport bridge wiring', () => {
  it('creates the bridge on first WAM plugin and notifies the new node', async () => {
    await editor.addWamPlugin(PLUGIN_URL);

    expect(createWamTransportBridge).toHaveBeenCalledTimes(1);
    expect(createWamTransportBridge).toHaveBeenCalledWith(adapter.transport, expect.any(Function));
    expect(bridge.notifyNodeAdded).toHaveBeenCalledWith(plugin.audioNode);
  });

  it('reuses one bridge across plugins and exposes live nodes via the getter', async () => {
    await editor.addWamPlugin(PLUGIN_URL);
    const second = makeMockPlugin();
    createWamInstance.mockResolvedValueOnce(second);
    const id2 = await editor.addWamPlugin(PLUGIN_URL + '?2');

    expect(createWamTransportBridge).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getNodes = (createWamTransportBridge.mock.calls as any)[0][1] as () => unknown[];
    expect(getNodes()).toEqual([plugin.audioNode, second.audioNode]);

    // Removing a plugin drops its node from the live set.
    editor.removeEffect(id2);
    expect(getNodes()).toEqual([plugin.audioNode]);
  });

  it('disposes the bridge when the editor disconnects', async () => {
    await editor.addWamPlugin(PLUGIN_URL);
    editor.remove();

    expect(bridge.dispose).toHaveBeenCalledTimes(1);
  });

  it('skips the bridge gracefully when the adapter transport lacks the query surface', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adapter.transport as any).on = undefined;
    await expect(editor.addWamPlugin(PLUGIN_URL)).resolves.toBeTruthy();
    expect(createWamTransportBridge).not.toHaveBeenCalled();
  });
});
