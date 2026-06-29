import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import type { DawEditorElement } from '../elements/daw-editor';
import type { DawTrackElement } from '../elements/daw-track';

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
});

function mockGainNode() {
  return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
}

function makeMockAdapter() {
  const ctx = {
    sampleRate: 48000,
    state: 'suspended' as AudioContextState,
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
    removeTrack: vi.fn(),
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

async function appendTrack(name = ''): Promise<DawTrackElement> {
  const track = document.createElement('daw-track') as DawTrackElement;
  if (name) track.setAttribute('name', name);
  editor.appendChild(track);
  await flush();
  return track;
}

describe('<daw-editor> track enumeration', () => {
  it('editor.tracks includes the trackId (and name) for each track', async () => {
    const a = await appendTrack('Kick');
    const b = await appendTrack('Bass');

    expect(editor.tracks.map((t) => ({ trackId: t.trackId, name: t.name }))).toEqual([
      { trackId: a.trackId, name: 'Kick' },
      { trackId: b.trackId, name: 'Bass' },
    ]);
  });

  it('daw-track-removed fires with the trackId when a track is removed', async () => {
    const track = await appendTrack('Kick');
    const onRemoved = vi.fn();
    editor.addEventListener('daw-track-removed', onRemoved as EventListener);

    track.remove();
    await flush(); // MutationObserver processes the child removal

    expect(onRemoved).toHaveBeenCalledTimes(1);
    expect((onRemoved.mock.calls[0][0] as CustomEvent).detail).toEqual({
      trackId: track.trackId,
    });
    // editor.tracks reflects the removal by the time the event fires
    expect(editor.tracks).toHaveLength(0);
  });

  it('does not fire daw-track-removed for a <daw-track> removed before it connected', async () => {
    const onRemoved = vi.fn();
    editor.addEventListener('daw-track-removed', onRemoved as EventListener);

    // Append then synchronously remove — the deferred daw-track-connected
    // (setTimeout 0) never runs, so the track is never registered in _tracks.
    const track = document.createElement('daw-track') as DawTrackElement;
    editor.appendChild(track);
    track.remove();
    await flush(); // MutationObserver processes the removal

    // Symmetric with daw-track-ready: a track that never became ready must not
    // emit a removal.
    expect(onRemoved).not.toHaveBeenCalled();
  });

  it('does not dispatch daw-track-removed on a detached editor (pattern #36)', async () => {
    const track = await appendTrack('Kick');
    const onRemoved = vi.fn();
    editor.addEventListener('daw-track-removed', onRemoved as EventListener);

    editor.remove(); // detach — a bubbling/composed event can't reach ancestors now
    editor.removeTrack(track.trackId); // element-less path → _onTrackRemoved synchronously

    expect(onRemoved).not.toHaveBeenCalled();
  });
});
