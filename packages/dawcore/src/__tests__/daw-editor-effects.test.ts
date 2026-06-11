import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import type { DawEditorElement } from '../elements/daw-editor';
import type { DawTrackElement } from '../elements/daw-track';

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
});

function mockGainNode() {
  return {
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function makeMockAdapter() {
  const ctx = {
    sampleRate: 48000,
    state: 'suspended' as AudioContextState,
    destination: { connect: vi.fn(), disconnect: vi.fn() },
    createGain: vi.fn(() => mockGainNode()),
    createDynamicsCompressor: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      threshold: { value: -24 },
      knee: { value: 30 },
      ratio: { value: 12 },
      attack: { value: 0.003 },
      release: { value: 0.25 },
    })),
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

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

let editor: DawEditorElement;
let adapter: ReturnType<typeof makeMockAdapter>;

beforeEach(() => {
  vi.stubGlobal('devicePixelRatio', 1);
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
  await flush();
  return track;
}

describe('<daw-editor> master effects API', () => {
  it('addEffect creates the master chain wired through connectMasterOutput', () => {
    const id = editor.addEffect('native-gain', { gain: 0.5 });

    expect(typeof id).toBe('string');
    expect(adapter.transport.connectMasterOutput).toHaveBeenCalledTimes(1);
    const chainInput = adapter.transport.connectMasterOutput.mock.calls[0][0];
    expect(chainInput).toBeTruthy();
    expect(editor.effects).toHaveLength(1);
    expect(editor.effects[0]).toMatchObject({
      kind: 'native',
      type: 'native-gain',
      params: { gain: 0.5 },
      bypassed: false,
    });
  });

  it('routes the master chain output to the destination', () => {
    editor.addEffect('native-gain');

    // The chain's output gain must be connected onward to ctx.destination.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gains = (adapter.audioContext.createGain as any).mock.results.map(
      (r: { value: ReturnType<typeof mockGainNode> }) => r.value
    );
    const wiredToDestination = gains.some((g: ReturnType<typeof mockGainNode>) =>
      g.connect.mock.calls.some(
        (c: unknown[]) => c[0] === (adapter.audioContext as AudioContext).destination
      )
    );
    expect(wiredToDestination).toBe(true);
  });

  it('addEffect with an unknown type throws listing available types', () => {
    expect(() => editor.addEffect('nope')).toThrow(/nope[\s\S]*native-gain/);
  });

  it('addEffect without an adapter throws a clear error', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bare = document.createElement('daw-editor') as any;
    document.body.appendChild(bare);
    try {
      expect(() => bare.addEffect('native-gain')).toThrow(/adapter/i);
    } finally {
      bare.remove();
    }
  });

  it('full chain ops: setEffectParams / setEffectBypassed / moveEffect / removeEffect', () => {
    const a = editor.addEffect('native-gain');
    const b = editor.addEffect('native-compressor');

    editor.setEffectParams(a, { gain: 0.25 });
    expect(editor.effects[0].params.gain).toBe(0.25);

    editor.setEffectBypassed(a, true);
    expect(editor.effects[0].bypassed).toBe(true);

    editor.moveEffect(b, 0);
    expect(editor.effects.map((e) => e.id)).toEqual([b, a]);

    editor.removeEffect(a);
    expect(editor.effects.map((e) => e.id)).toEqual([b]);
  });

  it('operations on an unknown effectId warn and no-op', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    editor.setEffectParams('nope', { gain: 1 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[waveform-playlist]'));
    expect(editor.effects).toHaveLength(0);
  });
});

describe('<daw-track> effects API', () => {
  it('addEffect wires the track chain via connectTrackOutput and routes to the master bus', async () => {
    const track = await appendTrack();
    const id = track.addEffect('native-gain');

    expect(typeof id).toBe('string');
    expect(adapter.transport.connectTrackOutput).toHaveBeenCalledWith(
      track.trackId,
      expect.anything()
    );
    expect(track.effects).toHaveLength(1);
    expect(track.effects[0].type).toBe('native-gain');
    // Master chain untouched
    expect(editor.effects).toHaveLength(0);
  });

  it('track effect events bubble to the editor with correct detail', async () => {
    const track = await appendTrack();
    const seen: Array<{ type: string; detail: Record<string, unknown> }> = [];
    for (const type of [
      'daw-effect-add',
      'daw-effect-change',
      'daw-effect-bypass',
      'daw-effect-reorder',
      'daw-effect-remove',
    ]) {
      editor.addEventListener(type, ((e: CustomEvent) => {
        seen.push({ type, detail: e.detail });
      }) as EventListener);
    }

    const id = track.addEffect('native-gain', { gain: 0.5 });
    track.setEffectParams(id, { gain: 0.75 });
    track.setEffectBypassed(id, true);
    const second = track.addEffect('native-compressor');
    track.moveEffect(second, 0);
    track.removeEffect(id);

    const types = seen.map((s) => s.type);
    expect(types).toEqual([
      'daw-effect-add',
      'daw-effect-change',
      'daw-effect-bypass',
      'daw-effect-add',
      'daw-effect-reorder',
      'daw-effect-remove',
    ]);
    expect(seen[0].detail).toMatchObject({ effectId: id, type: 'native-gain', index: 0 });
    expect(seen[1].detail).toMatchObject({ effectId: id, params: { gain: 0.75 } });
    expect(seen[2].detail).toMatchObject({ effectId: id, bypassed: true });
    expect(seen[4].detail).toMatchObject({ effectId: second, fromIndex: 1, toIndex: 0 });
    expect(seen[5].detail).toMatchObject({ effectId: id });
  });

  it('master effect events dispatch from the editor itself', () => {
    const onAdd = vi.fn();
    editor.addEventListener('daw-effect-add', onAdd as EventListener);

    editor.addEffect('native-gain');

    expect(onAdd).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((onAdd.mock.calls[0][0] as any).target).toBe(editor);
  });

  it('removing the track disposes its chain and disconnects the transport hook', async () => {
    const track = await appendTrack();
    track.addEffect('native-gain');

    track.remove();
    await flush();

    expect(adapter.transport.disconnectTrackOutput).toHaveBeenCalledWith(track.trackId);
  });

  it('disconnecting the editor disconnects the master chain', () => {
    editor.addEffect('native-gain');
    editor.remove();

    expect(adapter.transport.disconnectMasterOutput).toHaveBeenCalled();
  });

  it('replacing the adapter disposes chains from the OLD adapter graph', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const track = await appendTrack();
    editor.addEffect('native-gain');
    track.addEffect('native-gain');

    const next = makeMockAdapter();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor as any).adapter = next;

    // Chains were wired into the OLD adapter's transport — they must be
    // severed there, not on the new adapter (which never saw them).
    expect(adapter.transport.disconnectMasterOutput).toHaveBeenCalled();
    expect(adapter.transport.disconnectTrackOutput).toHaveBeenCalledWith(track.trackId);
    expect(next.transport.disconnectMasterOutput).not.toHaveBeenCalled();
    expect(editor.effects).toHaveLength(0);
    expect(track.effects).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('effect'));
  });
});
