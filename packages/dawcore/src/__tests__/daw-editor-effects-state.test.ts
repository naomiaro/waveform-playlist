import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import type { DawEditorElement } from '../elements/daw-editor';
import type { DawTrackElement } from '../elements/daw-track';

const { ensureWamHost, createWamInstance } = vi.hoisted(() => ({
  ensureWamHost: vi.fn(),
  createWamInstance: vi.fn(),
}));

vi.mock('@dawcore/wam', () => ({ ensureWamHost, createWamInstance }));

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
});

const PLUGIN_URL = 'https://plugins.example.com/reverb/index.js';

function mockGainNode() {
  return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
}

function makeMockPlugin(url = PLUGIN_URL, state: unknown = { preset: 'hall' }) {
  return {
    url,
    descriptor: {
      name: 'Mock Reverb',
      apiVersion: '2.0.0',
      hasAudioInput: true,
      hasAudioOutput: true,
    },
    audioNode: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      setParameterValues: vi.fn().mockResolvedValue(undefined),
    },
    getState: vi.fn().mockResolvedValue(state),
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
    createDelay: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      delayTime: { value: 0 },
    })),
    createStereoPanner: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      pan: { value: 0 },
    })),
    resume: vi.fn().mockResolvedValue(undefined),
    decodeAudioData: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    audioContext: ctx as unknown as AudioContext,
    ppqn: 960,
    transport: {
      connectTrackOutput: vi.fn(),
      disconnectTrackOutput: vi.fn(),
      connectMasterOutput: vi.fn(),
      disconnectMasterOutput: vi.fn(),
      masterOutputNode: mockGainNode(),
    },
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

describe('effects chain persistence', () => {
  it('round-trips a mixed chain through getEffectsState/setEffectsState', async () => {
    const nativeId = editor.addEffect('native-gain', { gain: 0.4 });
    await editor.addWamPlugin(PLUGIN_URL);
    editor.setEffectBypassed(nativeId, true);

    const saved = await editor.getEffectsState();
    expect(saved).toEqual([
      { kind: 'native', type: 'native-gain', params: { gain: 0.4 }, bypassed: true },
      { kind: 'wam', url: PLUGIN_URL, bypassed: false, state: { preset: 'hall' } },
    ]);

    // Restore into a fresh editor.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fresh = document.createElement('daw-editor') as any;
    fresh.adapter = makeMockAdapter();
    document.body.appendChild(fresh);
    try {
      await fresh.setEffectsState(saved);

      expect(fresh.effects.map((e: { kind: string }) => e.kind)).toEqual(['native', 'wam']);
      expect(fresh.effects[0]).toMatchObject({
        type: 'native-gain',
        params: { gain: 0.4 },
        bypassed: true,
      });
      expect(fresh.effects[1]).toMatchObject({ url: PLUGIN_URL, bypassed: false });
      // Saved WAM state was forwarded into instantiation.
      expect(createWamInstance).toHaveBeenLastCalledWith(
        PLUGIN_URL,
        fresh.adapter.audioContext,
        'group-1',
        { initialState: { preset: 'hall' } }
      );
    } finally {
      fresh.remove();
    }
  });

  it('setEffectsState replaces the existing chain (old entries disposed)', async () => {
    await editor.addWamPlugin(PLUGIN_URL);

    await editor.setEffectsState([
      { kind: 'native', type: 'native-gain', params: { gain: 1 }, bypassed: false },
    ]);

    expect(plugin.destroy).toHaveBeenCalledTimes(1);
    expect(editor.effects).toHaveLength(1);
    expect(editor.effects[0].type).toBe('native-gain');
  });

  it('rejects malformed input without modifying the existing chain', async () => {
    editor.addEffect('native-gain');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(editor.setEffectsState({ not: 'an array' } as any)).rejects.toThrow(
      /\[waveform-playlist\]/
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(editor.setEffectsState([{ kind: 'wam' }] as any)).rejects.toThrow(/url/);

    expect(editor.effects).toHaveLength(1);
  });

  it('an unreachable WAM url restores as a bypassed placeholder, preserving position and state', async () => {
    const onError = vi.fn();
    editor.addEventListener('daw-effect-error', onError as EventListener);
    createWamInstance.mockRejectedValueOnce(new Error('404 plugin not found'));

    await editor.setEffectsState([
      { kind: 'native', type: 'native-gain', params: { gain: 0.5 }, bypassed: false },
      { kind: 'wam', url: PLUGIN_URL, bypassed: false, state: { preset: 'plate' } },
      { kind: 'native', type: 'native-stereo-panner', params: { pan: -0.5 }, bypassed: false },
    ]);

    // All three entries present, the failed plugin as a bypassed placeholder
    expect(editor.effects).toHaveLength(3);
    expect(editor.effects[1]).toMatchObject({
      kind: 'wam',
      url: PLUGIN_URL,
      bypassed: true,
      error: expect.stringContaining('404'),
    });
    expect(onError).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((onError.mock.calls[0][0] as any).detail).toMatchObject({
      url: PLUGIN_URL,
      message: expect.stringContaining('404'),
    });

    // The saved state survives a re-serialize so a later retry can restore it.
    const resaved = await editor.getEffectsState();
    expect(resaved[1]).toMatchObject({
      kind: 'wam',
      url: PLUGIN_URL,
      state: { preset: 'plate' },
    });
  });

  it('a plugin whose getState rejects degrades to a state-less entry instead of failing the snapshot', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    editor.addEffect('native-gain');
    await editor.addWamPlugin(PLUGIN_URL);
    plugin.getState.mockRejectedValueOnce(new Error('worklet crashed'));

    const saved = await editor.getEffectsState();

    expect(saved).toHaveLength(2);
    expect(saved[1]).toEqual({ kind: 'wam', url: PLUGIN_URL, bypassed: false });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('worklet crashed'));
  });

  it('a superseding setEffectsState aborts the stale restore (last writer wins)', async () => {
    let resolveInstance!: (p: ReturnType<typeof makeMockPlugin>) => void;
    createWamInstance.mockReset().mockReturnValueOnce(
      new Promise((resolve) => {
        resolveInstance = resolve;
      })
    );

    const slow = editor.setEffectsState([
      { kind: 'wam', url: PLUGIN_URL, bypassed: false },
      { kind: 'native', type: 'native-gain', params: { gain: 0.9 }, bypassed: false },
    ]);
    const fast = editor.setEffectsState([
      { kind: 'native', type: 'native-stereo-panner', params: { pan: 0.5 }, bypassed: false },
    ]);
    await fast;
    resolveInstance(plugin);
    await slow;

    // Only the newest restore's content survives; the stale wam was discarded.
    expect(editor.effects).toHaveLength(1);
    expect(editor.effects[0].type).toBe('native-stereo-panner');
    expect(plugin.destroy).toHaveBeenCalled();
  });

  it('param/bypass edits on an error placeholder warn and no-op', async () => {
    createWamInstance.mockRejectedValueOnce(new Error('404'));
    await editor.setEffectsState([{ kind: 'wam', url: PLUGIN_URL, bypassed: false }]);
    const placeholderId = editor.effects[0].id;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onChange = vi.fn();
    editor.addEventListener('daw-effect-change', onChange as EventListener);

    editor.setEffectParams(placeholderId, { gain: 0.5 });
    editor.setEffectBypassed(placeholderId, false);

    expect(warn).toHaveBeenCalledTimes(2);
    expect(onChange).not.toHaveBeenCalled();
    expect(editor.effects[0].bypassed).toBe(true);
  });

  it('works per-track on <daw-track>', async () => {
    const track = await appendTrack();
    track.addEffect('native-gain', { gain: 0.7 });

    const saved = await track.getEffectsState();
    expect(saved).toEqual([
      { kind: 'native', type: 'native-gain', params: { gain: 0.7 }, bypassed: false },
    ]);

    const other = await appendTrack();
    await other.setEffectsState(saved);
    expect(other.effects).toHaveLength(1);
    expect(other.effects[0].params.gain).toBe(0.7);
  });
});
