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

  it('purges audio caches when a clip transitions from audio to MIDI', async () => {
    const editor = document.createElement('daw-editor') as any;
    const adapter = makeMockAdapter();
    editor.adapter = adapter;
    document.body.appendChild(editor);

    const trackId = 'track-1';
    const clipId = 'clip-1';
    const fakeBuffer = {
      length: 48000,
      sampleRate: 48000,
      numberOfChannels: 1,
    } as AudioBuffer;

    // Manually populate audio caches as if an audio clip had previously loaded
    editor._clipBuffers = new Map(editor._clipBuffers).set(clipId, fakeBuffer);
    editor._clipOffsets.set(clipId, { offsetSamples: 0, durationSamples: 48000 });
    editor._peaksData = new Map(editor._peaksData).set(clipId, {
      data: [new Int16Array(0)],
      length: 0,
      bits: 16,
    });

    // Populate _engineTracks with an audio clip so _applyClipUpdate can find it
    editor._engineTracks = new Map(editor._engineTracks).set(trackId, {
      id: trackId,
      name: 'Test',
      volume: 1,
      pan: 0,
      muted: false,
      soloed: false,
      clips: [
        {
          id: clipId,
          audioBuffer: fakeBuffer,
          startSample: 0,
          durationSamples: 48000,
          offsetSamples: 0,
          sourceDurationSamples: 48000,
          sampleRate: 48000,
          gain: 1,
          midiNotes: undefined,
        },
      ],
    });
    editor._tracks = new Map(editor._tracks).set(trackId, {
      name: 'Test',
      src: '',
      volume: 1,
      pan: 0,
      muted: false,
      soloed: false,
      renderMode: 'waveform',
      clips: [],
    });

    // Simulate a DawClipElement with midiNotes set (audio→MIDI transition)
    const fakeClipEl = {
      midiNotes: [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }],
      midiChannel: null,
      midiProgram: null,
      start: 0,
      duration: 0.5,
      offset: 0,
      gain: 1,
      name: 'X',
    };

    editor._applyClipUpdate(trackId, clipId, fakeClipEl);

    // Audio caches should be purged after an audio→MIDI transition
    expect(editor._clipBuffers.has(clipId)).toBe(false);
    expect(editor._clipOffsets.has(clipId)).toBe(false);
    expect(editor._peaksData.has(clipId)).toBe(false);

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

  it('updateTrack({ midi }) is silently ignored — does not create or modify clips', async () => {
    const editor = document.createElement('daw-editor') as any;
    editor.adapter = makeMockAdapter();
    document.body.appendChild(editor);

    const track = await editor.addTrack({ name: 'Audio Track' }); // no midi
    const clipsBefore = track.querySelectorAll('daw-clip').length;

    // updateTrack with midi field — should be silently ignored per JSDoc contract
    editor.updateTrack(track.trackId, {
      midi: { notes: [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }] },
    });
    await track.updateComplete;

    const clipsAfter = track.querySelectorAll('daw-clip').length;
    expect(clipsAfter).toBe(clipsBefore);
    expect(track.getAttribute('render-mode')).toBeNull(); // not flipped to piano-roll
    document.body.removeChild(editor);
  });

  it('does not emit "no AudioBuffer" warning for piano-roll tracks during statechange', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const editor = document.createElement('daw-editor') as any;
      editor.adapter = makeMockAdapter();
      document.body.appendChild(editor);

      await editor.addTrack({
        name: 'MIDI',
        midi: {
          notes: [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }],
        },
      });

      // Trigger a tracksVersion bump by calling _applyClipUpdate path via property change
      // Simplest: re-emit statechange manually if engine exists, or do a no-op update.
      // Use updateClip on the auto-created MIDI clip:
      const trackEl = editor.querySelector('daw-track');
      const clipEl = trackEl?.querySelector('daw-clip');
      if (clipEl) {
        clipEl.midiNotes = [{ midi: 62, name: 'D4', time: 0, duration: 0.5, velocity: 0.8 }];
        await clipEl.updateComplete;
        await new Promise((r) => setTimeout(r, 0));
      }

      const warnCalls = warnSpy.mock.calls
        .map((c) => String(c[0]))
        .filter((s) => s.includes('no AudioBuffer'));
      expect(warnCalls).toEqual([]);
      document.body.removeChild(editor);
    } finally {
      warnSpy.mockRestore();
    }
  });

  describe('isMidiClip', () => {
    it('returns false for unknown trackId', () => {
      const editor = document.createElement('daw-editor') as any;
      editor.adapter = makeMockAdapter();
      document.body.appendChild(editor);
      expect(editor.isMidiClip('missing-track', 'any-clip')).toBe(false);
      document.body.removeChild(editor);
    });

    it('returns false for known track but unknown clipId', async () => {
      const editor = document.createElement('daw-editor') as any;
      editor.adapter = makeMockAdapter();
      document.body.appendChild(editor);
      const track = await editor.addTrack({
        name: 'M',
        midi: { notes: [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }] },
      });
      expect(editor.isMidiClip(track.trackId, 'missing-clip')).toBe(false);
      document.body.removeChild(editor);
    });

    it('returns true for an empty-array placeholder MIDI clip', async () => {
      // Critical: empty array != undefined, must still register as MIDI
      const editor = document.createElement('daw-editor') as any;
      editor.adapter = makeMockAdapter();
      document.body.appendChild(editor);
      const trackEl = document.createElement('daw-track') as any;
      trackEl.setAttribute('render-mode', 'piano-roll');
      const clipEl = document.createElement('daw-clip') as any;
      clipEl.duration = 4; // placeholder span
      trackEl.appendChild(clipEl);
      editor.appendChild(trackEl);
      await new Promise<void>((resolve) => {
        editor.addEventListener('daw-track-ready', () => resolve(), { once: true });
      });
      expect(editor.isMidiClip(trackEl.trackId, clipEl.clipId)).toBe(true);
      document.body.removeChild(editor);
    });

    it('returns true for a clip with non-empty midiNotes', async () => {
      const editor = document.createElement('daw-editor') as any;
      editor.adapter = makeMockAdapter();
      document.body.appendChild(editor);
      const track = await editor.addTrack({
        name: 'M',
        midi: { notes: [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }] },
      });
      const clipEl = track.querySelector('daw-clip');
      expect(editor.isMidiClip(track.trackId, clipEl.clipId)).toBe(true);
      document.body.removeChild(editor);
    });
  });
});

describe('splitAtPlayhead MIDI guard', () => {
  function makeMidiTrack(
    clipId: string,
    durationSamples: number,
    midiNotes: import('@waveform-playlist/core').MidiNoteData[]
  ) {
    return {
      id: 't1',
      name: 'MIDI Track',
      volume: 1,
      pan: 0,
      muted: false,
      soloed: false,
      clips: [
        {
          id: clipId,
          startSample: 0,
          durationSamples,
          offsetSamples: 0,
          sourceDurationSamples: durationSamples,
          sampleRate: 48000,
          gain: 1,
          midiNotes,
        },
      ],
    };
  }

  it('returns false and does not dispatch daw-clip-split for a MIDI clip', async () => {
    const { splitAtPlayhead } = await import('../interactions/split-handler');

    const splitClipFn = vi.fn();
    const dispatchEventFn = vi.fn(() => true);

    const host: Parameters<typeof splitAtPlayhead>[0] = {
      effectiveSampleRate: 48000,
      currentTime: 1.0,
      isPlaying: false,
      engine: {
        getState: () => ({
          selectedTrackId: 't1',
          tracks: [
            makeMidiTrack('c1', 96000, [
              { midi: 60, name: 'C4', time: 0, duration: 1, velocity: 0.8 },
            ]),
          ],
        }),
        splitClip: splitClipFn,
      },
      dispatchEvent: dispatchEventFn,
      stop: vi.fn(),
      play: vi.fn(),
    };

    const result = splitAtPlayhead(host);

    expect(result).toBe(false);
    expect(splitClipFn).not.toHaveBeenCalled();
    expect(dispatchEventFn).not.toHaveBeenCalled();
  });

  it('returns false for MIDI clip even when playhead is well inside clip bounds', async () => {
    const { splitAtPlayhead } = await import('../interactions/split-handler');

    // Playhead at 2.0s, clip is 4s long (192000 samples at 48kHz).
    // Without the MIDI guard this would be a valid split position.
    const host: Parameters<typeof splitAtPlayhead>[0] = {
      effectiveSampleRate: 48000,
      currentTime: 2.0,
      isPlaying: false,
      engine: {
        getState: () => ({
          selectedTrackId: 't1',
          tracks: [makeMidiTrack('c1', 192000, [])],
        }),
        splitClip: vi.fn(),
      },
      dispatchEvent: vi.fn(() => true),
      stop: vi.fn(),
      play: vi.fn(),
    };

    const result = splitAtPlayhead(host);
    expect(result).toBe(false);
  });
});
