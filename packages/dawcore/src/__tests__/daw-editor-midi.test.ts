import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
});

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal('devicePixelRatio', 1);
  fetchSpy = vi.fn().mockRejectedValue(new Error('fetch should not have been called'));
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeMockAdapter() {
  // Minimal PlayoutAdapter stub — engine accepts but doesn't actually play.
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

describe('<daw-editor> MIDI loading', () => {
  it('does not fetch when a clip has midiNotes set', async () => {
    const editor = document.createElement('daw-editor') as any;
    editor.adapter = makeMockAdapter();
    document.body.appendChild(editor);

    const track = document.createElement('daw-track') as any;
    track.setAttribute('render-mode', 'piano-roll');
    track.setAttribute('name', 'Lead');

    const clip = document.createElement('daw-clip') as any;
    clip.midiNotes = [
      { midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 },
      { midi: 64, name: 'E4', time: 0.5, duration: 0.5, velocity: 0.7 },
    ];
    track.appendChild(clip);
    editor.appendChild(track);

    await new Promise<void>((resolve) => {
      editor.addEventListener('daw-track-ready', () => resolve(), { once: true });
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    document.body.removeChild(editor);
  });

  it('passes midiNotes through to engine.setTracks', async () => {
    const editor = document.createElement('daw-editor') as any;
    const adapter = makeMockAdapter();
    editor.adapter = adapter;
    document.body.appendChild(editor);

    const track = document.createElement('daw-track') as any;
    track.setAttribute('render-mode', 'piano-roll');
    const clip = document.createElement('daw-clip') as any;
    const notes = [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }];
    clip.midiNotes = notes;
    track.appendChild(clip);
    editor.appendChild(track);

    await new Promise<void>((resolve) => {
      editor.addEventListener('daw-track-ready', () => resolve(), { once: true });
    });

    const lastCall = adapter.setTracks.mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    const tracks = lastCall![0];
    expect(tracks).toHaveLength(1);
    expect(tracks[0].clips).toHaveLength(1);
    expect(tracks[0].clips[0].midiNotes).toEqual(notes);
    expect(tracks[0].clips[0].audioBuffer).toBeUndefined();
    document.body.removeChild(editor);
  });

  it('mounts <daw-piano-roll> when track.renderMode === "piano-roll"', async () => {
    await import('../elements/daw-piano-roll');
    const editor = document.createElement('daw-editor') as any;
    editor.adapter = makeMockAdapter();
    document.body.appendChild(editor);

    const track = document.createElement('daw-track') as any;
    track.setAttribute('render-mode', 'piano-roll');
    const clip = document.createElement('daw-clip') as any;
    clip.midiNotes = [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }];
    track.appendChild(clip);
    editor.appendChild(track);

    await new Promise<void>((resolve) => {
      editor.addEventListener('daw-track-ready', () => resolve(), { once: true });
    });
    await editor.updateComplete;

    const pianoRoll = editor.shadowRoot.querySelector('daw-piano-roll');
    const waveform = editor.shadowRoot.querySelector('daw-waveform');
    expect(pianoRoll).toBeTruthy();
    expect(waveform).toBeFalsy();
    document.body.removeChild(editor);
  });

  it('registers a placeholder clip (no notes, no duration) so late arrivals can find it', async () => {
    const editor = document.createElement('daw-editor') as any;
    const adapter = makeMockAdapter();
    editor.adapter = adapter;
    document.body.appendChild(editor);

    const track = document.createElement('daw-track') as any;
    track.setAttribute('render-mode', 'piano-roll');
    // Clip with neither midiNotes nor duration — pure placeholder
    const clip = document.createElement('daw-clip') as any;
    track.appendChild(clip);
    editor.appendChild(track);

    await new Promise<void>((resolve) => {
      editor.addEventListener('daw-track-ready', () => resolve(), { once: true });
    });

    const lastCall = adapter.setTracks.mock.calls.at(-1);
    const engineClip = lastCall![0][0].clips[0];
    // Discriminator: must be != null (and specifically [] in this case)
    expect(engineClip.midiNotes).toEqual([]);
    expect(engineClip.midiNotes).not.toBeUndefined();
    // 1-second placeholder span at 48000 Hz
    expect(engineClip.sourceDurationSamples).toBe(48000);
    // No audio buffer
    expect(engineClip.audioBuffer).toBeUndefined();
    document.body.removeChild(editor);
  });

  it('addTrack({ midi }) creates a piano-roll track with one MIDI clip', async () => {
    const editor = document.createElement('daw-editor') as any;
    const adapter = makeMockAdapter();
    editor.adapter = adapter;
    document.body.appendChild(editor);

    const notes = [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }];
    const track = await editor.addTrack({
      name: 'Lead',
      midi: { notes, channel: 0, program: 24 },
    });

    expect(track.getAttribute('render-mode')).toBe('piano-roll');
    expect(track.name).toBe('Lead');
    const clipEls = track.querySelectorAll('daw-clip');
    expect(clipEls.length).toBe(1);
    expect(clipEls[0].midiNotes).toEqual(notes);
    expect(clipEls[0].midiChannel).toBe(0);
    expect(clipEls[0].midiProgram).toBe(24);
    document.body.removeChild(editor);
  });

  it('updates engine clip when midiNotes is assigned after track-ready', async () => {
    const editor = document.createElement('daw-editor') as any;
    const adapter = makeMockAdapter();
    editor.adapter = adapter;
    document.body.appendChild(editor);

    const track = document.createElement('daw-track') as any;
    track.setAttribute('render-mode', 'piano-roll');
    const clip = document.createElement('daw-clip') as any;
    clip.duration = 4; // placeholder span — notes not yet set
    track.appendChild(clip);
    editor.appendChild(track);

    await new Promise<void>((resolve) => {
      editor.addEventListener('daw-track-ready', () => resolve(), { once: true });
    });
    // Engine always takes the incremental path — updateTrack is a required mock field.
    const updateTrackCallsBefore = adapter.updateTrack.mock.calls.length;

    // Now assign notes
    const notes = [
      { midi: 60, name: 'C4', time: 0, duration: 1, velocity: 0.8 },
      { midi: 64, name: 'E4', time: 1, duration: 1, velocity: 0.6 },
    ];
    clip.midiNotes = notes;
    await clip.updateComplete;
    // _applyClipUpdate is sync after the event; allow microtasks
    await new Promise((r) => setTimeout(r, 0));

    const updateTrackCallsAfter = adapter.updateTrack.mock.calls.length;
    expect(updateTrackCallsAfter).toBeGreaterThan(updateTrackCallsBefore);

    const lastUpdateTrack = adapter.updateTrack.mock.calls.at(-1);
    expect(lastUpdateTrack).toBeDefined();
    const updatedClip = lastUpdateTrack![1].clips[0];
    expect(updatedClip).toBeDefined();
    expect(updatedClip!.midiNotes).toEqual(notes);
    expect(updatedClip!.audioBuffer).toBeUndefined();
    document.body.removeChild(editor);
  });

  it('updateTrack({ renderMode: "piano-roll" }) sets render-mode attribute on DOM track', async () => {
    const editor = document.createElement('daw-editor') as any;
    editor.adapter = makeMockAdapter();
    document.body.appendChild(editor);

    const track = await editor.addTrack({ name: 'Test' });
    expect(track.getAttribute('render-mode')).toBeNull();

    editor.updateTrack(track.trackId, { renderMode: 'piano-roll' });
    await track.updateComplete;
    expect(track.getAttribute('render-mode')).toBe('piano-roll');
    document.body.removeChild(editor);
  });
});
