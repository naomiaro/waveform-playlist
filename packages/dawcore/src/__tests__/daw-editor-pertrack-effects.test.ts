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

describe('<daw-editor> per-track effects API (by trackId)', () => {
  it('addTrackEffect adds an effect to a track by id, reflected in trackEffects', async () => {
    const track = await appendTrack();

    const id = editor.addTrackEffect(track.trackId, 'native-gain', { gain: 0.5 });

    expect(typeof id).toBe('string');
    expect(adapter.transport.connectTrackOutput).toHaveBeenCalledWith(
      track.trackId,
      expect.anything()
    );
    expect(editor.trackEffects(track.trackId)).toHaveLength(1);
    expect(editor.trackEffects(track.trackId)[0]).toMatchObject({
      type: 'native-gain',
      params: { gain: 0.5 },
      bypassed: false,
    });
    // Master chain untouched
    expect(editor.effects).toHaveLength(0);
  });

  it('per-track effect events dispatch from the <daw-track> element when one exists', async () => {
    const track = await appendTrack();
    const onAdd = vi.fn();
    editor.addEventListener('daw-effect-add', onAdd as EventListener);

    editor.addTrackEffect(track.trackId, 'native-gain');

    expect(onAdd).toHaveBeenCalledTimes(1);
    // Same event source as track.addEffect(...) — the op is identical regardless
    // of which API surface (element method vs editor-by-id) was used.
    expect((onAdd.mock.calls[0][0] as Event).target).toBe(track);
  });

  it('per-track effect events dispatch from the editor for an element-less (dropped) track', () => {
    const onAdd = vi.fn();
    editor.addEventListener('daw-effect-add', onAdd as EventListener);

    // No <daw-track> element for this id — simulates a drag-dropped / programmatic track.
    editor.addTrackEffect('dropped-track-1', 'native-gain');

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect((onAdd.mock.calls[0][0] as Event).target).toBe(editor);
    expect(editor.trackEffects('dropped-track-1')).toHaveLength(1);
  });

  it('full chain ops by id: setTrackEffectParams / setTrackEffectBypassed / moveTrackEffect / removeTrackEffect', async () => {
    const track = await appendTrack();
    const a = editor.addTrackEffect(track.trackId, 'native-gain');
    const b = editor.addTrackEffect(track.trackId, 'native-compressor');

    editor.setTrackEffectParams(track.trackId, a, { gain: 0.25 });
    expect(editor.trackEffects(track.trackId)[0].params.gain).toBe(0.25);

    editor.setTrackEffectBypassed(track.trackId, a, true);
    expect(editor.trackEffects(track.trackId)[0].bypassed).toBe(true);

    editor.moveTrackEffect(track.trackId, b, 0);
    expect(editor.trackEffects(track.trackId).map((e) => e.id)).toEqual([b, a]);

    editor.removeTrackEffect(track.trackId, a);
    expect(editor.trackEffects(track.trackId).map((e) => e.id)).toEqual([b]);
  });

  it('getTrackEffectsState / setTrackEffectsState round-trip a track chain by id', async () => {
    const track = await appendTrack();
    editor.addTrackEffect(track.trackId, 'native-gain', { gain: 0.4 });
    editor.addTrackEffect(track.trackId, 'native-compressor');

    const state = await editor.getTrackEffectsState(track.trackId);
    expect(state).toHaveLength(2);

    await editor.setTrackEffectsState(track.trackId, []);
    expect(editor.trackEffects(track.trackId)).toHaveLength(0);

    await editor.setTrackEffectsState(track.trackId, state);
    expect(editor.trackEffects(track.trackId).map((e) => e.type)).toEqual([
      'native-gain',
      'native-compressor',
    ]);
    expect(editor.trackEffects(track.trackId)[0].params.gain).toBe(0.4);
  });

  it('mutating ops on an unknown trackId warn and no-op (no throw)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => {
      editor.removeTrackEffect('ghost-track', 'fx-1');
      editor.setTrackEffectParams('ghost-track', 'fx-1', { gain: 1 });
      editor.setTrackEffectBypassed('ghost-track', 'fx-1', true);
      editor.moveTrackEffect('ghost-track', 'fx-1', 0);
    }).not.toThrow();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[waveform-playlist]'));
    expect(editor.trackEffects('ghost-track')).toHaveLength(0);
  });
});
