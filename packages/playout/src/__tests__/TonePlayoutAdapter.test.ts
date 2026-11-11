import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock audioContext module
vi.mock('../audioContext', () => ({
  getGlobalAudioContext: vi.fn().mockReturnValue({
    sampleRate: 48000,
  } as unknown as AudioContext),
  getGlobalContext: vi.fn().mockReturnValue({ lookAhead: 0.1 }),
  isNativeGlobalContext: vi.fn(() => true),
}));

// Mock TonePlayout before importing adapter
vi.mock('../TonePlayout', () => {
  return {
    TonePlayout: vi.fn().mockImplementation(function () {
      return {
        init: vi.fn().mockResolvedValue(undefined),
        addTrack: vi.fn(),
        addMidiTrack: vi.fn(),
        addSoundFontTrack: vi.fn(),
        applyInitialSoloState: vi.fn(),
        play: vi.fn(),
        pause: vi.fn(),
        stop: vi.fn(),
        seekTo: vi.fn(),
        getCurrentTime: vi.fn().mockReturnValue(0),
        setMasterGain: vi.fn(),
        setMute: vi.fn(),
        setSolo: vi.fn(),
        getTrack: vi.fn().mockReturnValue({
          setVolume: vi.fn(),
          setPan: vi.fn(),
        }),
        getTrackIds: vi.fn().mockReturnValue([]),
        removeTrack: vi.fn(),
        replaceTrackClips: vi.fn().mockReturnValue(false),
        resumeTrackMidPlayback: vi.fn(),
        dispose: vi.fn(),
        setOnPlaybackComplete: vi.fn(),
        setLoop: vi.fn(),
        connectTrackEffects: vi.fn(),
        disconnectTrackEffects: vi.fn(),
        connectMasterOutput: vi.fn(),
        disconnectMasterOutput: vi.fn(),
        masterBusInputNode: { nodeType: 1 },
      };
    }),
  };
});

// Mock Tone.js now() function
vi.mock('tone', () => ({
  now: vi.fn().mockReturnValue(0.1),
}));

import { createToneAdapter, isToneAdapter } from '../TonePlayoutAdapter';
import { TonePlayout } from '../TonePlayout';
import { isNativeGlobalContext } from '../audioContext';
import type { ClipTrack, AudioClip, TrackKind } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import type { SoundFontCache } from '../SoundFontCache';

function makeClip(
  overrides: Partial<AudioClip> & {
    id: string;
    startSample: number;
    durationSamples: number;
  }
): AudioClip {
  return {
    offsetSamples: 0,
    sampleRate: 44100,
    sourceDurationSamples: 441000,
    gain: 1,
    audioBuffer: {} as AudioBuffer, // Fake buffer so clip is "playable"
    ...overrides,
  };
}

function makeTrack(
  id: string,
  clips: AudioClip[],
  kind: TrackKind = clips[0]?.midiNotes ? 'midi' : 'audio'
): ClipTrack {
  return { id, kind, name: `Track ${id}`, clips, muted: false, soloed: false, volume: 1, pan: 0 };
}

function makeMidiClip(
  overrides: Partial<AudioClip> & {
    id: string;
    startSample: number;
    durationSamples: number;
  }
): AudioClip {
  return {
    offsetSamples: 0,
    sampleRate: 44100,
    sourceDurationSamples: 441000,
    gain: 1,
    midiNotes: [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }],
    midiChannel: 0,
    midiProgram: 5,
    ...overrides,
  };
}

const loadedCache = { isLoaded: true } as unknown as SoundFontCache;
const unloadedCache = { isLoaded: false } as unknown as SoundFontCache;

describe('createToneAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('init', () => {
    it('calls playout.init()', async () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })]),
      ]);
      await adapter.init();
      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockInstance.init).toHaveBeenCalled();
    });
  });

  describe('setTracks', () => {
    it('creates TonePlayout and adds tracks with real IDs', () => {
      const adapter = createToneAdapter();
      const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      adapter.setTracks([makeTrack('my-track', [clip])]);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockInstance.addTrack).toHaveBeenCalledTimes(1);

      const addTrackArg = mockInstance.addTrack.mock.calls[0][0];
      expect(addTrackArg.track.id).toBe('my-track');
    });

    it('converts clips from samples to seconds', () => {
      const adapter = createToneAdapter();
      const clip = makeClip({
        id: 'c1',
        startSample: 44100,
        durationSamples: 22050,
        offsetSamples: 11025,
      });
      adapter.setTracks([makeTrack('t1', [clip])]);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      const addTrackArg = mockInstance.addTrack.mock.calls[0][0];
      const clipInfo = addTrackArg.clips[0];

      // clipInfo.startTime is relative to track startTime (1.0)
      // clip starts at 1.0s, track starts at 1.0s, so relative = 0
      expect(clipInfo.startTime).toBe(0);
      expect(clipInfo.duration).toBeCloseTo(0.5);
      expect(clipInfo.offset).toBeCloseTo(0.25);
    });

    it('skips clips without audioBuffer', () => {
      const adapter = createToneAdapter();
      const playable = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      const peaksOnly = makeClip({ id: 'c2', startSample: 44100, durationSamples: 44100 });
      delete (peaksOnly as Partial<AudioClip>).audioBuffer;

      adapter.setTracks([makeTrack('t1', [playable, peaksOnly])]);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      const addTrackArg = mockInstance.addTrack.mock.calls[0][0];
      expect(addTrackArg.clips).toHaveLength(1);
    });

    it('skips tracks with no playable clips', () => {
      const adapter = createToneAdapter();
      const peaksOnly = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      delete (peaksOnly as Partial<AudioClip>).audioBuffer;

      adapter.setTracks([makeTrack('t1', [peaksOnly])]);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockInstance.addTrack).not.toHaveBeenCalled();
    });

    it('calls applyInitialSoloState after adding tracks', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })]),
      ]);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockInstance.applyInitialSoloState).toHaveBeenCalled();
    });

    it('reuses playout on subsequent setTracks calls (incremental update)', () => {
      const adapter = createToneAdapter();
      const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      adapter.setTracks([makeTrack('t1', [clip])]);

      const firstInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;

      // Second setTracks should NOT dispose — incremental update
      firstInstance.getTrackIds.mockReturnValue(['t1']);
      adapter.setTracks([makeTrack('t2', [clip])]);
      expect(firstInstance.dispose).not.toHaveBeenCalled();
      // Old track removed, new track added
      expect(firstInstance.removeTrack).toHaveBeenCalledWith('t1');
    });

    // #752: a track's effects come from the adapter's `trackEffects` lookup,
    // by track id. Tracks are plain data and carry no function.
    it('asks trackEffects for the function of each track it builds', () => {
      const effectsFn = vi.fn();
      const trackEffects = vi.fn((trackId: string) => (trackId === 't1' ? effectsFn : undefined));
      const adapter = createToneAdapter({ trackEffects });
      const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      adapter.setTracks([makeTrack('t1', [clip]), makeTrack('t2', [clip])]);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockInstance.addTrack.mock.calls[0][0].effects).toBe(effectsFn);
      expect(mockInstance.addTrack.mock.calls[1][0].effects).toBeUndefined();
      expect(trackEffects).toHaveBeenCalledWith('t1');
      expect(trackEffects).toHaveBeenCalledWith('t2');
    });

    it('asks trackEffects again for a track added later', () => {
      const effectsFn = vi.fn();
      const adapter = createToneAdapter({ trackEffects: () => effectsFn });
      const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      adapter.setTracks([]);
      adapter.addTrack!(makeTrack('t9', [clip]));

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockInstance.addTrack.mock.lastCall![0].effects).toBe(effectsFn);
    });

    it('asks again when updateTrack builds a track that had no audio (a filled placeholder)', () => {
      const effectsFn = vi.fn();
      const trackEffects = vi.fn(() => effectsFn);
      const adapter = createToneAdapter({ trackEffects });
      adapter.setTracks([makeTrack('t1', [])]);
      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockInstance.addTrack).not.toHaveBeenCalled();

      const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      adapter.updateTrack!('t1', makeTrack('t1', [clip]));

      expect(mockInstance.addTrack).toHaveBeenCalledTimes(1);
      expect(mockInstance.addTrack.mock.lastCall![0].effects).toBe(effectsFn);
    });

    it('does not ask when updateTrack only replaces the clips of an audio track', () => {
      const trackEffects = vi.fn(() => vi.fn());
      const adapter = createToneAdapter({ trackEffects });
      const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      adapter.setTracks([makeTrack('t1', [clip])]);
      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      mockInstance.replaceTrackClips.mockReturnValue(true);
      trackEffects.mockClear();

      adapter.updateTrack!('t1', makeTrack('t1', [{ ...clip, startSample: 22050 }]));

      expect(trackEffects).not.toHaveBeenCalled();
      expect(mockInstance.addTrack).toHaveBeenCalledTimes(1);
    });

    it('asks again when updateTrack rebuilds a MIDI-only track', () => {
      const effectsFn = vi.fn();
      const adapter = createToneAdapter({ trackEffects: () => effectsFn });
      const midiTrack = makeTrack('t1', [
        makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 }),
      ]);
      adapter.setTracks([midiTrack]);
      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;

      adapter.updateTrack!('t1', midiTrack);

      expect(mockInstance.addMidiTrack).toHaveBeenCalledTimes(2);
      expect(mockInstance.addMidiTrack.mock.lastCall![0].effects).toBe(effectsFn);
    });

    it('asks again when a SoundFont swap rebuilds a MIDI track', () => {
      const effectsFn = vi.fn();
      const adapter = createToneAdapter({ trackEffects: () => effectsFn });
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);
      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;

      adapter.setSoundFontCache(loadedCache);

      expect(mockInstance.addSoundFontTrack).toHaveBeenCalledTimes(1);
      expect(mockInstance.addSoundFontTrack.mock.lastCall![0].effects).toBe(effectsFn);
    });

    it('asks again for the playout built after dispose', () => {
      const effectsFn = vi.fn();
      const adapter = createToneAdapter({ trackEffects: () => effectsFn });
      const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      adapter.setTracks([makeTrack('t1', [clip])]);
      adapter.dispose();
      adapter.setTracks([makeTrack('t1', [clip])]);

      const results = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results;
      expect(results).toHaveLength(2);
      expect(results[1].value.addTrack.mock.lastCall![0].effects).toBe(effectsFn);
    });

    it('ignores an `effects` field left on a track object', () => {
      const adapter = createToneAdapter();
      const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      const track = makeTrack('t1', [clip]);
      (track as unknown as Record<string, unknown>).effects = vi.fn();
      adapter.setTracks([track]);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockInstance.addTrack.mock.calls[0][0].effects).toBeUndefined();
    });
  });

  describe('play', () => {
    it('calls playout.play with converted args', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 441000 })]),
      ]);
      adapter.play(1.5);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      // play(when, offset, duration) -- when=now(), offset=startTime, duration=undefined
      expect(mockInstance.play).toHaveBeenCalledWith(expect.any(Number), 1.5, undefined);
    });

    it('computes duration from endTime - startTime', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 441000 })]),
      ]);
      adapter.play(1.0, 3.0);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockInstance.play).toHaveBeenCalledWith(expect.any(Number), 1.0, 2.0);
    });

    it('sets isPlaying to true', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })]),
      ]);
      adapter.play(0);
      expect(adapter.isPlaying()).toBe(true);
    });

    it('sets isPlaying to false on natural playback completion', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })]),
      ]);
      adapter.play(0);
      expect(adapter.isPlaying()).toBe(true);

      // Simulate natural playback completion via the callback
      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      const completionCallback = mockInstance.setOnPlaybackComplete.mock.calls[0][0];
      completionCallback();

      expect(adapter.isPlaying()).toBe(false);
    });

    it('completion callback still works after incremental setTracks', () => {
      const adapter = createToneAdapter();
      const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      adapter.setTracks([makeTrack('t1', [clip])]);
      adapter.play(0);
      expect(adapter.isPlaying()).toBe(true);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      const callback = instance.setOnPlaybackComplete.mock.calls[0][0];

      // Incremental update — same playout, callback still valid
      instance.getTrackIds.mockReturnValue(['t1']);
      adapter.setTracks([makeTrack('t1', [clip])]);

      // Callback fires — resets isPlaying (not stale, same playout)
      callback();
      expect(adapter.isPlaying()).toBe(false);
    });

    it('delegates init to playout.init', async () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })]),
      ]);
      await adapter.init();

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockInstance.init).toHaveBeenCalled();
    });
  });

  describe('pause', () => {
    it('delegates to playout.pause and sets isPlaying false', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })]),
      ]);
      adapter.play(0);
      adapter.pause();

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockInstance.pause).toHaveBeenCalled();
      expect(adapter.isPlaying()).toBe(false);
    });
  });

  describe('stop', () => {
    it('delegates to playout.stop and sets isPlaying false', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })]),
      ]);
      adapter.play(0);
      adapter.stop();

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockInstance.stop).toHaveBeenCalled();
      expect(adapter.isPlaying()).toBe(false);
    });
  });

  describe('seek', () => {
    it('delegates to playout.seekTo', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })]),
      ]);
      adapter.seek(2.5);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockInstance.seekTo).toHaveBeenCalledWith(2.5);
    });
  });

  describe('getCurrentTime', () => {
    it('delegates to playout.getCurrentTime', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })]),
      ]);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      (mockInstance.getCurrentTime as ReturnType<typeof vi.fn>).mockReturnValue(3.5);

      expect(adapter.getCurrentTime()).toBe(3.5);
    });
  });

  describe('track controls', () => {
    it('delegates setMasterVolume to playout.setMasterGain', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })]),
      ]);
      adapter.setMasterVolume(0.75);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockInstance.setMasterGain).toHaveBeenCalledWith(0.75);
    });

    it('delegates setTrackMute', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })]),
      ]);
      adapter.setTrackMute('t1', true);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockInstance.setMute).toHaveBeenCalledWith('t1', true);
    });

    it('delegates setTrackSolo', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })]),
      ]);
      adapter.setTrackSolo('t1', true);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockInstance.setSolo).toHaveBeenCalledWith('t1', true);
    });

    it('delegates setTrackVolume to track.setVolume', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })]),
      ]);
      adapter.setTrackVolume('t1', 0.5);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockInstance.getTrack).toHaveBeenCalledWith('t1');
      const mockTrack = mockInstance.getTrack.mock.results[0].value;
      expect(mockTrack.setVolume).toHaveBeenCalledWith(0.5);
    });

    it('delegates setTrackPan to track.setPan', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })]),
      ]);
      adapter.setTrackPan('t1', -0.5);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockInstance.getTrack).toHaveBeenCalledWith('t1');
      const mockTrack = mockInstance.getTrack.mock.results[0].value;
      expect(mockTrack.setPan).toHaveBeenCalledWith(-0.5);
    });

    // A track is one playout track under its own id (#756). There is no
    // companion id for any control to forward to.
    describe('one playout track per track', () => {
      function everyIdTouched(instance: Record<string, ReturnType<typeof vi.fn>>): string[] {
        return ['getTrack', 'setMute', 'setSolo', 'removeTrack', 'resumeTrackMidPlayback'].flatMap(
          (method) => instance[method].mock.calls.map((call) => String(call[0]))
        );
      }

      it.each(['audio', 'midi'] as const)('controls of a %s track address only its id', (kind) => {
        const adapter = createToneAdapter();
        const clip =
          kind === 'midi'
            ? makeMidiClip({ id: 'c1', startSample: 0, durationSamples: 44100 })
            : makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
        const track = makeTrack('t1', [clip]);
        adapter.setTracks([track]);
        adapter.play(0);

        adapter.setTrackMute('t1', true);
        adapter.setTrackSolo('t1', true);
        adapter.setTrackVolume('t1', 0.5);
        adapter.setTrackPan('t1', 0.25);
        adapter.updateTrack!('t1', track);
        adapter.setTracks([track]);
        adapter.removeTrack!('t1');

        const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
        const ids = everyIdTouched(instance);
        expect(ids.length).toBeGreaterThan(0);
        expect(ids.filter((id) => id !== 't1')).toEqual([]);
      });

      it('a MIDI track runs the track effects closure itself', () => {
        const effects = vi.fn();
        const adapter = createToneAdapter({ trackEffects: () => effects });
        adapter.setTracks([
          makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
        ]);

        const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
        expect(instance.addMidiTrack.mock.calls[0][0].effects).toBe(effects);
        expect(instance.addTrack).not.toHaveBeenCalled();
      });

      it('builds from the kind, not from the clips: an audio track never builds a MIDI track', () => {
        const adapter = createToneAdapter();
        // A track the engine would have rejected: the adapter follows `kind`.
        adapter.setTracks([
          makeTrack(
            't1',
            [
              makeClip({ id: 'a1', startSample: 0, durationSamples: 44100 }),
              makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 }),
            ],
            'audio'
          ),
        ]);

        const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
        expect(instance.addTrack).toHaveBeenCalledTimes(1);
        expect(instance.addTrack.mock.calls[0][0].clips).toHaveLength(1);
        expect(instance.addMidiTrack).not.toHaveBeenCalled();
      });

      it('updateTrack on a MIDI track rebuilds it without trying a clip-level audio update', () => {
        const adapter = createToneAdapter();
        const track = makeTrack('t1', [
          makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 }),
        ]);
        adapter.setTracks([track]);
        const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;

        adapter.updateTrack!('t1', track);

        expect(instance.replaceTrackClips).not.toHaveBeenCalled();
        expect(instance.removeTrack).toHaveBeenCalledWith('t1');
        expect(instance.addMidiTrack).toHaveBeenCalledTimes(2);
      });

      it('updateTrack removes a MIDI track whose last clip was deleted', () => {
        const adapter = createToneAdapter();
        adapter.setTracks([
          makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
        ]);
        const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;

        adapter.updateTrack!('t1', makeTrack('t1', [], 'midi'));

        expect(instance.removeTrack).toHaveBeenCalledWith('t1');
        expect(instance.addMidiTrack).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('setLoop', () => {
    it('delegates to playout.setLoop', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })]),
      ]);
      adapter.setLoop(true, 1.0, 3.0);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockInstance.setLoop).toHaveBeenCalledWith(true, 1.0, 3.0);
    });

    it('is safe to call without setTracks', () => {
      const adapter = createToneAdapter();
      expect(() => adapter.setLoop(true, 0, 5)).not.toThrow();
    });

    it('preserves loop state across incremental setTracks', () => {
      const adapter = createToneAdapter();
      const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });

      adapter.setTracks([makeTrack('t1', [clip])]);
      adapter.setLoop(true, 2.0, 6.0);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      instance.getTrackIds.mockReturnValue(['t1']);

      // Incremental update — same playout, loop state persists
      adapter.setTracks([makeTrack('t2', [clip])]);

      // Same instance — setLoop was called originally, no re-apply needed
      // (playout persists, Transport keeps its loop config)
      expect(instance.dispose).not.toHaveBeenCalled();
    });
  });

  describe('audioInitialized persistence', () => {
    it('playout stays initialized across incremental setTracks', async () => {
      const adapter = createToneAdapter();
      const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });

      adapter.setTracks([makeTrack('t1', [clip])]);
      await adapter.init();

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.init).toHaveBeenCalled();

      // Incremental update — no new playout, no re-init needed
      instance.getTrackIds.mockReturnValue(['t1']);
      adapter.setTracks([makeTrack('t2', [clip])]);

      // Only one TonePlayout instance was ever created
      expect((TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results).toHaveLength(1);
    });

    it('incremental setTracks does not require init', () => {
      const adapter = createToneAdapter();
      const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });

      adapter.setTracks([makeTrack('t1', [clip])]);
      // No init() call

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      instance.getTrackIds.mockReturnValue(['t1']);
      adapter.setTracks([makeTrack('t2', [clip])]);

      // Same playout, no re-init
      expect((TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results).toHaveLength(1);
    });
  });

  describe('play guards', () => {
    it('play() before setTracks works (playout created eagerly)', () => {
      const adapter = createToneAdapter();
      adapter.play(0);
      expect(adapter.isPlaying()).toBe(true);
    });
  });

  describe('dispose', () => {
    it('disposes playout', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 })]),
      ]);
      adapter.dispose();

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockInstance.dispose).toHaveBeenCalled();
    });

    it('is safe to call without setTracks', () => {
      const adapter = createToneAdapter();
      expect(() => adapter.dispose()).not.toThrow();
    });
  });

  describe('addTrack (incremental)', () => {
    it('adds a track to existing playout without rebuilding', () => {
      const adapter = createToneAdapter();
      const clip1 = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      adapter.setTracks([makeTrack('t1', [clip1])]);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(mockInstance.addTrack).toHaveBeenCalledTimes(1);

      // Incrementally add a second track
      const clip2 = makeClip({ id: 'c2', startSample: 0, durationSamples: 22050 });
      adapter.addTrack!(makeTrack('t2', [clip2]));

      // addTrack called twice total (once from setTracks, once from addTrack)
      expect(mockInstance.addTrack).toHaveBeenCalledTimes(2);
      // applyInitialSoloState called on addTrack
      expect(mockInstance.applyInitialSoloState).toHaveBeenCalled();

      const addTrackArg = mockInstance.addTrack.mock.calls[1][0];
      expect(addTrackArg.track.id).toBe('t2');
    });

    it('does not create a new TonePlayout instance', () => {
      const adapter = createToneAdapter();
      const clip1 = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      adapter.setTracks([makeTrack('t1', [clip1])]);

      // One TonePlayout created by setTracks
      expect(TonePlayout).toHaveBeenCalledTimes(1);

      const clip2 = makeClip({ id: 'c2', startSample: 0, durationSamples: 22050 });
      adapter.addTrack!(makeTrack('t2', [clip2]));

      // Still only one TonePlayout — no rebuild
      expect(TonePlayout).toHaveBeenCalledTimes(1);
    });

    it('addTrack works before setTracks (playout created eagerly)', () => {
      const adapter = createToneAdapter();

      const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });

      expect(() => adapter.addTrack!(makeTrack('t1', [clip]))).not.toThrow();
    });
  });

  describe('updateTrack (pan law, #669)', () => {
    it('passes the track source channel count with the clip update', () => {
      const adapter = createToneAdapter();
      const mono = makeClip({ id: 'a1', startSample: 0, durationSamples: 44100 });
      adapter.setTracks([makeTrack('t1', [mono])]);
      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      instance.replaceTrackClips.mockReturnValue(true);

      // A stereo clip joins the mono track: the law must follow.
      const stereo = makeClip({
        id: 'a2',
        startSample: 44100,
        durationSamples: 44100,
        audioBuffer: { numberOfChannels: 2, duration: 1, sampleRate: 44100 } as AudioBuffer,
      });
      adapter.updateTrack!('t1', makeTrack('t1', [mono, stereo]));

      expect(instance.replaceTrackClips).toHaveBeenLastCalledWith(
        't1',
        expect.any(Array),
        expect.any(Number),
        2
      );
    });
  });

  describe('tempo and meter', () => {
    it('setTempo sets the BPM', () => {
      const adapter = createToneAdapter();
      adapter.setTempo!(120);
      expect(adapter.ticksToSeconds!(192)).toBeCloseTo(0.5);
    });

    it('setTempo throws when atTick is provided', () => {
      const adapter = createToneAdapter();
      expect(() => adapter.setTempo!(140, 960)).toThrow('Multiple tempo changes not supported');
    });

    it('setMeter does not throw for single meter', () => {
      const adapter = createToneAdapter();
      adapter.setMeter!(3, 4);
    });

    it('setMeter throws when atTick is provided', () => {
      const adapter = createToneAdapter();
      expect(() => adapter.setMeter!(6, 8, 960)).toThrow('Multiple meter changes not supported');
    });

    it('ticksToSeconds converts using current BPM and ppqn', () => {
      const adapter = createToneAdapter();
      // Default: 120 BPM, 192 PPQ → 384 ticks = 2 beats = 1s
      expect(adapter.ticksToSeconds!(384)).toBeCloseTo(1.0);
    });

    it('secondsToTicks converts using current BPM and ppqn, returning an integer tick', () => {
      const adapter = createToneAdapter();
      expect(adapter.secondsToTicks!(1.0)).toBe(384);
      // 0.0005 s is 0.192 ticks: the integer contract rounds it, as the native adapter does
      expect(adapter.secondsToTicks!(0.0005)).toBe(0);
      expect(adapter.secondsToTicks!(0.002)).toBe(1); // 0.768 ticks
    });

    it('secondsToTicksExact returns the fractional tick position', () => {
      const adapter = createToneAdapter();
      // 120 BPM × 192 PPQN = 384 ticks/s → 0.0005 s is 0.192 ticks
      expect(adapter.secondsToTicksExact!(0.0005)).toBeCloseTo(0.192, 10);
    });

    it('secondsToTicksExact follows tempo and ppqn changes', () => {
      const adapter = createToneAdapter();
      adapter.setTempo!(60);
      expect(adapter.secondsToTicksExact!(0.0005)).toBeCloseTo(0.096, 10);
      const fine = createToneAdapter({ ppqn: 960 });
      expect(fine.secondsToTicksExact!(0.0005)).toBeCloseTo(0.96, 10);
    });

    it('ticksToSeconds reflects updated BPM', () => {
      const adapter = createToneAdapter();
      adapter.setTempo!(60);
      // At 60 BPM, 192 PPQ: 192 ticks = 1 beat = 1s
      expect(adapter.ticksToSeconds!(192)).toBeCloseTo(1.0);
    });

    it('accepts custom ppqn via options', () => {
      const adapter = createToneAdapter({ ppqn: 960 });
      // At 120 BPM, 960 PPQ: 960 ticks = 1 beat = 0.5s
      expect(adapter.ticksToSeconds!(960)).toBeCloseTo(0.5);
    });
  });

  describe('audioContext', () => {
    it('exposes the global audio context', () => {
      const adapter = createToneAdapter();
      expect(adapter.audioContext).toBeDefined();
      expect(adapter.audioContext!.sampleRate).toBe(48000);
    });
  });

  describe('lookAhead', () => {
    it('exposes the Tone Context lookAhead so consumers can align the playhead with audible output', () => {
      const adapter = createToneAdapter();
      expect(adapter.lookAhead).toBe(0.1);
    });
  });

  describe('ppqn', () => {
    it('defaults to 192', () => {
      const adapter = createToneAdapter();
      expect(adapter.ppqn).toBe(192);
    });

    it('uses custom ppqn from options', () => {
      const adapter = createToneAdapter({ ppqn: 960 });
      expect(adapter.ppqn).toBe(960);
    });
  });

  describe('setSoundFontCache', () => {
    it('upgrades existing MIDI tracks from PolySynth to soundfont', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addMidiTrack).toHaveBeenCalledTimes(1);

      adapter.setSoundFontCache(loadedCache);

      expect(instance.removeTrack).toHaveBeenCalledWith('t1');
      expect(instance.addSoundFontTrack).toHaveBeenCalledTimes(1);
      expect(instance.addSoundFontTrack.mock.calls[0][0].soundFontCache).toBe(loadedCache);
      expect(instance.applyInitialSoloState).toHaveBeenCalled();
    });

    it('leaves audio tracks untouched when swapping', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('audio', [makeClip({ id: 'a1', startSample: 0, durationSamples: 44100 })]),
        makeTrack('midi', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addTrack).toHaveBeenCalledTimes(1);

      adapter.setSoundFontCache(loadedCache);

      // Audio track was not removed or re-added
      expect(instance.addTrack).toHaveBeenCalledTimes(1);
      expect(instance.removeTrack).not.toHaveBeenCalledWith('audio');
      expect(instance.removeTrack).toHaveBeenCalledWith('midi');
    });

    it('reverts to PolySynth when called with undefined', () => {
      const adapter = createToneAdapter({ soundFontCache: loadedCache });
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addSoundFontTrack).toHaveBeenCalledTimes(1);

      adapter.setSoundFontCache(undefined);

      expect(instance.removeTrack).toHaveBeenCalledWith('t1');
      expect(instance.addMidiTrack).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when effective routing is unchanged (same loaded cache)', () => {
      const adapter = createToneAdapter({ soundFontCache: loadedCache });
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      instance.removeTrack.mockClear();
      instance.addSoundFontTrack.mockClear();
      instance.applyInitialSoloState.mockClear();

      adapter.setSoundFontCache(loadedCache);

      expect(instance.removeTrack).not.toHaveBeenCalled();
      expect(instance.addSoundFontTrack).not.toHaveBeenCalled();
      expect(instance.applyInitialSoloState).not.toHaveBeenCalled();
    });

    it('rebuilds when the SAME cache object finishes loading late', () => {
      // The late-load race: cache passed at creation, tracks added before load completes
      const lateCache = { isLoaded: false } as unknown as SoundFontCache;
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const adapter = createToneAdapter({ soundFontCache: lateCache });
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);
      warnSpy.mockRestore();

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addMidiTrack).toHaveBeenCalledTimes(1);

      // load() completes — same object, isLoaded flips
      (lateCache as unknown as { isLoaded: boolean }).isLoaded = true;
      adapter.setSoundFontCache(lateCache);

      expect(instance.removeTrack).toHaveBeenCalledWith('t1');
      expect(instance.addSoundFontTrack).toHaveBeenCalledTimes(1);
    });

    it('resumes mid-playback when swapping during playback', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);
      adapter.play(0);

      adapter.setSoundFontCache(loadedCache);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.resumeTrackMidPlayback).toHaveBeenCalledWith('t1');
    });

    it('rebuilt track reflects volume/mute changes made before the swap', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);
      adapter.setTrackVolume('t1', 0.5);
      adapter.setTrackMute('t1', true);

      adapter.setSoundFontCache(loadedCache);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      const arg = instance.addSoundFontTrack.mock.calls[0][0];
      expect(arg.track.gain).toBe(0.5);
      expect(arg.track.muted).toBe(true);
    });

    it('does not rebuild tracks removed via removeTrack', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);
      adapter.removeTrack!('t1');

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      instance.removeTrack.mockClear();

      adapter.setSoundFontCache(loadedCache);

      expect(instance.removeTrack).not.toHaveBeenCalled();
      expect(instance.addSoundFontTrack).not.toHaveBeenCalled();
    });

    it('is safe to call before setTracks and applies on later adds', () => {
      const adapter = createToneAdapter();
      expect(() => adapter.setSoundFontCache(loadedCache)).not.toThrow();

      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addSoundFontTrack).toHaveBeenCalledTimes(1);
      expect(instance.addMidiTrack).not.toHaveBeenCalled();
    });

    it('is safe to call after dispose (stores only)', () => {
      const adapter = createToneAdapter();
      adapter.dispose();
      expect(() => adapter.setSoundFontCache(loadedCache)).not.toThrow();
    });

    it('rebuilt track reflects pan/solo changes made before the swap', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);
      adapter.setTrackPan('t1', -0.5);
      adapter.setTrackSolo('t1', true);

      adapter.setSoundFontCache(loadedCache);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      const arg = instance.addSoundFontTrack.mock.calls[0][0];
      expect(arg.track.stereoPan).toBe(-0.5);
      expect(arg.track.soloed).toBe(true);
    });

    it('upgrades every MIDI track in one swap, with a single solo-state reapply', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('m1', [makeMidiClip({ id: 'c1', startSample: 0, durationSamples: 44100 })]),
        makeTrack('audio', [makeClip({ id: 'a1', startSample: 0, durationSamples: 44100 })]),
        makeTrack('m2', [makeMidiClip({ id: 'c2', startSample: 0, durationSamples: 44100 })]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      instance.applyInitialSoloState.mockClear();

      adapter.setSoundFontCache(loadedCache);

      expect(instance.addSoundFontTrack).toHaveBeenCalledTimes(2);
      const swappedIds = instance.addSoundFontTrack.mock.calls.map(
        (call: [{ track: { id: string } }]) => call[0].track.id
      );
      expect(swappedIds).toEqual(['m1', 'm2']);
      expect(instance.addTrack).toHaveBeenCalledTimes(1);
      expect(instance.removeTrack).not.toHaveBeenCalledWith('audio');
      expect(instance.applyInitialSoloState).toHaveBeenCalledTimes(1);
    });

    it('warns and does not rebuild when the cache is not loaded (effective routing unchanged)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      instance.removeTrack.mockClear();
      instance.addMidiTrack.mockClear();
      instance.applyInitialSoloState.mockClear();

      adapter.setSoundFontCache(unloadedCache);

      expect(instance.removeTrack).not.toHaveBeenCalled();
      expect(instance.addMidiTrack).not.toHaveBeenCalled();
      expect(instance.addSoundFontTrack).not.toHaveBeenCalled();
      expect(instance.applyInitialSoloState).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Await cache.load()'));
      warnSpy.mockRestore();
    });

    it('isolates a per-track failure: remaining tracks still swap and solo state reapplies', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('m1', [makeMidiClip({ id: 'c1', startSample: 0, durationSamples: 44100 })]),
        makeTrack('m2', [makeMidiClip({ id: 'c2', startSample: 0, durationSamples: 44100 })]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      instance.removeTrack.mockImplementationOnce(() => {
        throw new Error('cross-context connect failure');
      });

      expect(() => adapter.setSoundFontCache(loadedCache)).not.toThrow();

      // m1 failed (caught + warned); m2 still upgraded; solo state reapplied
      expect(instance.addSoundFontTrack).toHaveBeenCalledTimes(1);
      expect(instance.addSoundFontTrack.mock.calls[0][0].track.id).toBe('m2');
      expect(instance.applyInitialSoloState).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('SoundFont swap failed for track')
      );
      warnSpy.mockRestore();
    });

    it('defaults programNumber to 0 when the clip has no midiProgram', () => {
      const adapter = createToneAdapter({ soundFontCache: loadedCache });
      adapter.setTracks([
        makeTrack('t1', [
          makeMidiClip({
            id: 'm1',
            startSample: 0,
            durationSamples: 44100,
            midiProgram: undefined,
          }),
        ]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addSoundFontTrack.mock.calls[0][0].programNumber).toBe(0);
    });

    it('upgrades tracks added via addTrack (incremental path)', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeClip({ id: 'a1', startSample: 0, durationSamples: 44100 })]),
      ]);
      adapter.addTrack!(
        makeTrack('t2', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })])
      );

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addMidiTrack).toHaveBeenCalledTimes(1);

      adapter.setSoundFontCache(loadedCache);

      expect(instance.removeTrack).toHaveBeenCalledWith('t2');
      expect(instance.addSoundFontTrack).toHaveBeenCalledTimes(1);
    });

    it('rebuilds from the updated clips after updateTrack then swap', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);

      const updated = makeTrack('t1', [
        makeMidiClip({ id: 'm1', startSample: 88200, durationSamples: 44100 }),
      ]);
      adapter.updateTrack!('t1', updated);

      adapter.setSoundFontCache(loadedCache);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      const arg = instance.addSoundFontTrack.mock.calls[0][0];
      // 88200 samples @44100Hz = 2s — proves the post-update snapshot was used
      expect(arg.track.startTime).toBe(2);
    });
  });

  describe('soundfont routing', () => {
    it('routes MIDI tracks to addSoundFontTrack when cache is loaded at creation', () => {
      const adapter = createToneAdapter({ soundFontCache: loadedCache });
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addSoundFontTrack).toHaveBeenCalledTimes(1);
      expect(instance.addMidiTrack).not.toHaveBeenCalled();

      const arg = instance.addSoundFontTrack.mock.calls[0][0];
      expect(arg.track.id).toBe('t1');
      expect(arg.programNumber).toBe(5);
      expect(arg.isPercussion).toBe(false);
      expect(arg.soundFontCache).toBe(loadedCache);
    });

    it('sets isPercussion for MIDI channel 9', () => {
      const adapter = createToneAdapter({ soundFontCache: loadedCache });
      adapter.setTracks([
        makeTrack('t1', [
          makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100, midiChannel: 9 }),
        ]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addSoundFontTrack.mock.calls[0][0].isPercussion).toBe(true);
    });

    it('falls back to addMidiTrack when no cache is provided', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addMidiTrack).toHaveBeenCalledTimes(1);
      expect(instance.addSoundFontTrack).not.toHaveBeenCalled();
    });

    it('falls back to addMidiTrack (with warning) when cache is not loaded', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const adapter = createToneAdapter({ soundFontCache: unloadedCache });
      adapter.setTracks([
        makeTrack('t1', [makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 })]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addMidiTrack).toHaveBeenCalledTimes(1);
      expect(instance.addSoundFontTrack).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SoundFont not loaded'));
      warnSpy.mockRestore();
    });
  });

  describe('isToneAdapter', () => {
    it('narrows createToneAdapter output', () => {
      const adapter = createToneAdapter();
      expect(isToneAdapter(adapter)).toBe(true);
    });

    it('rejects null and undefined', () => {
      expect(isToneAdapter(null)).toBe(false);
      expect(isToneAdapter(undefined)).toBe(false);
    });

    it('rejects adapters without the soundfont capability', () => {
      const bare = { play: vi.fn(), pause: vi.fn() } as unknown as PlayoutAdapter;
      expect(isToneAdapter(bare)).toBe(false);
    });
  });

  describe('adapter.transport (effects hooks)', () => {
    it('is structurally compatible with dawcore EffectsTransportLike', () => {
      // Copied verbatim from packages/dawcore/src/effects/effects-manager.ts —
      // guards against the wrong-method-name trap (root CLAUDE.md pattern #11).
      interface EffectsTransportLike {
        connectTrackEffects(trackId: string, input: AudioNode, output: AudioNode): void;
        disconnectTrackEffects(trackId: string): void;
        connectMasterOutput(node: AudioNode): void;
        disconnectMasterOutput(): void;
        readonly masterOutputNode: AudioNode;
      }
      vi.mocked(isNativeGlobalContext).mockReturnValue(true);
      const adapter = createToneAdapter();
      const t: EffectsTransportLike = adapter.transport; // compile-time check
      expect(typeof t.connectTrackEffects).toBe('function');
    });

    it('delegates hooks to the playout when native mode is on', () => {
      vi.mocked(isNativeGlobalContext).mockReturnValue(true);
      const adapter = createToneAdapter();
      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      const node = {} as AudioNode;

      const output = { name: 'out' } as unknown as AudioNode;
      adapter.transport.connectTrackEffects('t1', node, output);
      expect(mockInstance.connectTrackEffects).toHaveBeenCalledWith('t1', node, output);

      adapter.transport.connectMasterOutput(node);
      expect(mockInstance.connectMasterOutput).toHaveBeenCalledWith(node);

      expect(adapter.transport.masterOutputNode).toBe(mockInstance.masterBusInputNode);

      adapter.transport.disconnectTrackEffects('t1');
      adapter.transport.disconnectMasterOutput();
      expect(mockInstance.disconnectTrackEffects).toHaveBeenCalledWith('t1');
      expect(mockInstance.disconnectMasterOutput).toHaveBeenCalled();
    });

    it('throws a configure-native-context error when the global context is standardized', () => {
      vi.mocked(isNativeGlobalContext).mockReturnValue(false);
      const adapter = createToneAdapter();
      expect(() => adapter.transport.connectMasterOutput({} as AudioNode)).toThrow(
        /configureGlobalContext\(\{ nativeAudioContext: true \}\)/
      );
    });

    it('throws after dispose', () => {
      vi.mocked(isNativeGlobalContext).mockReturnValue(true);
      const adapter = createToneAdapter();
      adapter.dispose();
      expect(() => adapter.transport.connectMasterOutput({} as AudioNode)).toThrow(/dispose/);
    });
  });

  describe('onPlaybackEnded', () => {
    it('fires the subscribed callback when the playout reports completion', () => {
      const adapter = createToneAdapter();
      const ended = vi.fn();
      adapter.onPlaybackEnded!(ended);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      const completion = mockInstance.setOnPlaybackComplete.mock.calls.at(-1)![0] as () => void;
      completion();

      expect(ended).toHaveBeenCalledTimes(1);
      expect(adapter.isPlaying()).toBe(false); // internal flag flipped before notifying
    });

    it('null unsubscribes', () => {
      const adapter = createToneAdapter();
      const ended = vi.fn();
      adapter.onPlaybackEnded!(ended);
      adapter.onPlaybackEnded!(null);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      const completion = mockInstance.setOnPlaybackComplete.mock.calls.at(-1)![0] as () => void;
      completion();

      expect(ended).not.toHaveBeenCalled();
    });

    it('a fresh subscription is correctly wired after a real playout rebuild (dispose + setTracks)', () => {
      // createToneAdapter() eagerly constructs the first TonePlayout, and
      // setTracks() takes the INCREMENTAL path whenever a playout already
      // exists — buildPlayout() only runs when `playout` is null. dispose()
      // is the legitimate way to null it out (and — per the hygiene fix —
      // also clears any prior _onPlaybackEnded subscription), so the next
      // setTracks() call actually rebuilds and exercises the
      // generation-guarded wiring at buildPlayout()'s
      // `playout.setOnPlaybackComplete(...)` (~line 239). Subscribing after
      // the rebuild mirrors how a real consumer resubscribes post-dispose,
      // and still exercises the untested closure wiring: the NEW playout's
      // completion callback must read the CURRENT `_onPlaybackEnded`.
      const adapter = createToneAdapter();

      adapter.dispose();
      adapter.setTracks([]); // playout is null → buildPlayout() runs

      const ended = vi.fn();
      adapter.onPlaybackEnded!(ended);

      const mockCtor = TonePlayout as unknown as ReturnType<typeof vi.fn>;
      expect(mockCtor.mock.results).toHaveLength(2);
      const rebuiltInstance = mockCtor.mock.results[1].value;
      const completion = rebuiltInstance.setOnPlaybackComplete.mock.calls.at(-1)![0] as () => void;
      completion();

      expect(ended).toHaveBeenCalledTimes(1);
    });

    it('a stale completion callback from a superseded rebuild generation is swallowed by the generation guard', () => {
      // The eager (generation-1) playout created by createToneAdapter() wires
      // its completion callback with a hardcoded `_playoutGeneration === 1`
      // check — a DIFFERENT code path from buildPlayout()'s closure-captured
      // `generation === _playoutGeneration` guard (~line 240), which only
      // runs on rebuilds. To exercise THAT guard specifically, force TWO
      // rebuilds: capture the callback registered by the first rebuild
      // (generation 2), then force a second rebuild (generation 3) and fire
      // the now-stale generation-2 callback. Without the guard, this would
      // incorrectly flip isPlaying and fire the current onPlaybackEnded
      // subscriber.
      const adapter = createToneAdapter();
      const mockCtor = TonePlayout as unknown as ReturnType<typeof vi.fn>;

      adapter.dispose();
      adapter.setTracks([]); // rebuild #1 → generation 2, buildPlayout() wiring
      const generation2Instance = mockCtor.mock.results[1].value;
      const staleCompletion = generation2Instance.setOnPlaybackComplete.mock.calls.at(
        -1
      )![0] as () => void;

      adapter.dispose();
      adapter.setTracks([]); // rebuild #2 → generation 3, supersedes generation 2

      const ended = vi.fn();
      adapter.onPlaybackEnded!(ended);
      adapter.play(0);
      expect(adapter.isPlaying()).toBe(true);

      // Fire the stale generation-2 completion callback captured before rebuild #2.
      staleCompletion();

      expect(ended).not.toHaveBeenCalled();
      expect(adapter.isPlaying()).toBe(true);
    });
  });
});
