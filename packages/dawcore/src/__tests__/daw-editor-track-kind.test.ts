// #756: a track holds one kind of clip. <daw-track kind="audio|midi"> declares
// it; a clip of the other kind is not added and is reported.
import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
  await import('../elements/daw-piano-roll');
});

let fetchSpy: ReturnType<typeof vi.fn>;
let editors: HTMLElement[] = [];

beforeEach(() => {
  vi.stubGlobal('devicePixelRatio', 1);
  fetchSpy = vi.fn().mockRejectedValue(new Error('fetch should not have been called'));
  vi.stubGlobal('fetch', fetchSpy);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  for (const editor of editors) editor.remove();
  editors = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeMockAdapter() {
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

const NOTES = [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }];

function makeEditor() {
  const editor = document.createElement('daw-editor') as any;
  const adapter = makeMockAdapter();
  editor.adapter = adapter;
  document.body.appendChild(editor);
  editors.push(editor);
  const clipErrors: any[] = [];
  editor.addEventListener('daw-clip-error', (e: CustomEvent) => clipErrors.push(e.detail));
  return { editor, adapter, clipErrors };
}

function settled(editor: any, trackId: string): Promise<'ready' | 'error'> {
  return new Promise((resolve) => {
    editor.addEventListener('daw-track-ready', (e: CustomEvent) => {
      if (e.detail.trackId === trackId) resolve('ready');
    });
    editor.addEventListener('daw-track-error', (e: CustomEvent) => {
      if (e.detail.trackId === trackId) resolve('error');
    });
  });
}

/** Every clip any adapter call was handed. */
function clipsSentToAdapter(adapter: ReturnType<typeof makeMockAdapter>) {
  const fromSetTracks = adapter.setTracks.mock.calls.flatMap(([tracks]) =>
    tracks.flatMap((t: any) => t.clips)
  );
  const fromUpdate = adapter.updateTrack.mock.calls.flatMap(([, track]) => track.clips);
  return [...fromSetTracks, ...fromUpdate];
}

describe('<daw-track kind>', () => {
  it('defaults to audio and reflects the attribute', async () => {
    const track = document.createElement('daw-track') as any;
    expect(track.kind).toBe('audio');
    document.body.appendChild(track);
    editors.push(track);
    track.kind = 'midi';
    await track.updateComplete;
    expect(track.getAttribute('kind')).toBe('midi');
  });

  it('ignores a value that is not a kind', () => {
    const track = document.createElement('daw-track') as any;
    track.setAttribute('kind', 'video');
    expect(track.kind).toBe('audio');
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('is not a track kind'));
  });
});

describe('<daw-editor> one kind of clip per track (#756)', () => {
  it('a kind="midi" track reaches the engine as a MIDI track and is drawn as a piano roll', async () => {
    const { editor, adapter } = makeEditor();
    const track = document.createElement('daw-track') as any;
    track.setAttribute('kind', 'midi');
    const clip = document.createElement('daw-clip') as any;
    clip.midiNotes = NOTES;
    track.appendChild(clip);
    editor.appendChild(track);

    expect(await settled(editor, track.trackId)).toBe('ready');
    await editor.updateComplete;

    expect(adapter.setTracks.mock.lastCall![0][0].kind).toBe('midi');
    expect(editor.tracks[0]).toMatchObject({ kind: 'midi', renderMode: 'piano-roll' });
    expect(editor.shadowRoot.querySelector('daw-piano-roll')).not.toBeNull();
  });

  it('an empty MIDI track is a piano-roll track before it has any clip', async () => {
    const { editor, adapter } = makeEditor();
    await editor.addTrack({ name: 'Keys', kind: 'midi' });

    expect(editor.tracks[0]).toMatchObject({ kind: 'midi', renderMode: 'piano-roll' });
    expect(adapter.setTracks.mock.lastCall![0][0]).toMatchObject({ kind: 'midi', clips: [] });
  });

  it('render-mode="piano-roll" alone does not make a MIDI track: the MIDI clip is refused', async () => {
    const { editor, adapter, clipErrors } = makeEditor();
    const track = document.createElement('daw-track') as any;
    track.setAttribute('render-mode', 'piano-roll');
    track.setAttribute('name', 'Lead');
    const clip = document.createElement('daw-clip') as any;
    clip.midiNotes = NOTES;
    track.appendChild(clip);
    editor.appendChild(track);

    expect(await settled(editor, track.trackId)).toBe('error');

    expect(clipErrors).toHaveLength(1);
    expect(clipErrors[0].clipId).toBe(clip.clipId);
    expect(clipErrors[0].error.message).toMatch(/MIDI clip.*audio track "Lead".*kind="midi"/);
    expect(clipsSentToAdapter(adapter)).toEqual([]);
    // Not drawn as a piano roll either: the kind decides.
    expect(editor.tracks[0]).toMatchObject({ kind: 'audio', renderMode: 'waveform' });
  });

  it('an audio clip on a MIDI track is refused without being fetched; the MIDI clip loads', async () => {
    const { editor, adapter, clipErrors } = makeEditor();
    const track = document.createElement('daw-track') as any;
    track.setAttribute('kind', 'midi');
    track.setAttribute('name', 'Keys');
    const midiClip = document.createElement('daw-clip') as any;
    midiClip.midiNotes = NOTES;
    const audioClip = document.createElement('daw-clip') as any;
    audioClip.setAttribute('src', '/audio/take.mp3');
    track.append(midiClip, audioClip);
    editor.appendChild(track);

    expect(await settled(editor, track.trackId)).toBe('ready');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(clipErrors).toHaveLength(1);
    expect(clipErrors[0].clipId).toBe(audioClip.clipId);
    expect(clipErrors[0].error.message).toMatch(/audio clip on MIDI track "Keys"/);
    const sent = adapter.setTracks.mock.lastCall![0][0];
    expect(sent.clips).toHaveLength(1);
    expect(sent.clips[0].midiNotes).toEqual(NOTES);
  });

  it('addClip with a src onto a loaded MIDI track rejects and fetches nothing', async () => {
    const { editor, adapter } = makeEditor();
    const track = await editor.addTrack({ name: 'Keys', midi: { notes: NOTES } });
    adapter.updateTrack.mockClear();

    await expect(editor.addClip(track.trackId, { src: '/audio/take.mp3' })).rejects.toThrow(
      /audio clip on MIDI track "Keys"/
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(adapter.updateTrack).not.toHaveBeenCalled();
  });

  it('changing kind after the track has loaded is ignored with a warning', async () => {
    const { editor } = makeEditor();
    const track = await editor.addTrack({ name: 'Keys', midi: { notes: NOTES } });

    track.kind = 'audio';
    await track.updateComplete;

    expect(editor.tracks[0]).toMatchObject({ kind: 'midi', renderMode: 'piano-roll' });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('kind cannot change after the track has loaded')
    );
  });

  it('startRecording onto a MIDI track dispatches daw-recording-error and starts nothing', async () => {
    const { editor } = makeEditor();
    const track = await editor.addTrack({ name: 'Keys', midi: { notes: NOTES } });
    const start = vi.spyOn(editor._recordingController, 'startRecording');
    const errors: any[] = [];
    editor.addEventListener('daw-recording-error', (e: CustomEvent) => errors.push(e.detail));

    await editor.startRecording({} as MediaStream, { trackId: track.trackId });

    expect(start).not.toHaveBeenCalled();
    expect(errors).toHaveLength(1);
    expect(errors[0].trackId).toBe(track.trackId);
    expect(errors[0].error.message).toMatch(/Cannot record onto MIDI track "Keys"/);
  });

  it('an undo-restored MIDI track gets a MIDI descriptor', () => {
    const { editor } = makeEditor();
    editor._reconcileDescriptorsWithEngineTracks([
      { id: 'm', kind: 'midi', name: 'Keys', clips: [], volume: 1, pan: 0 },
      { id: 'a', kind: 'audio', name: 'Gtr', clips: [], volume: 1, pan: 0 },
    ]);

    const byName = Object.fromEntries(editor.tracks.map((t: any) => [t.name, t]));
    expect(byName.Keys).toMatchObject({ kind: 'midi', renderMode: 'piano-roll' });
    expect(byName.Gtr).toMatchObject({ kind: 'audio', renderMode: 'waveform' });
  });
});
