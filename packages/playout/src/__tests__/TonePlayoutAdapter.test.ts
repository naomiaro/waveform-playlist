import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock audioContext module
vi.mock('../audioContext', () => ({
  getGlobalAudioContext: vi.fn().mockReturnValue({
    sampleRate: 48000,
  } as unknown as AudioContext),
  getGlobalContext: vi.fn().mockReturnValue({ lookAhead: 0.1 }),
}));

// Mock TonePlayout before importing adapter
vi.mock('../TonePlayout', () => {
  return {
    TonePlayout: vi.fn().mockImplementation(() => ({
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
    })),
  };
});

// Mock Tone.js now() function
vi.mock('tone', () => ({
  now: vi.fn().mockReturnValue(0.1),
}));

import { createToneAdapter, isToneAdapter } from '../TonePlayoutAdapter';
import { TonePlayout } from '../TonePlayout';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
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

function makeTrack(id: string, clips: AudioClip[]): ClipTrack {
  return { id, name: `Track ${id}`, clips, muted: false, soloed: false, volume: 1, pan: 0 };
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

    it('passes track effects to playout.addTrack', () => {
      const adapter = createToneAdapter();
      const effectsFn = vi.fn();
      const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
      const track = makeTrack('t1', [clip]);
      (track as unknown as Record<string, unknown>).effects = effectsFn;
      adapter.setTracks([track]);

      const mockInstance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      const addTrackArg = mockInstance.addTrack.mock.calls[0][0];
      expect(addTrackArg.effects).toBe(effectsFn);
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

  describe('removeTrack', () => {
    it('removeTrack also removes the companion :midi playout track', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [
          makeClip({ id: 'a1', startSample: 0, durationSamples: 44100 }),
          makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 }),
        ]),
      ]);
      adapter.removeTrack!('t1');

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.removeTrack).toHaveBeenCalledWith('t1');
      expect(instance.removeTrack).toHaveBeenCalledWith('t1:midi');
    });
  });

  describe('updateTrack (companion MIDI)', () => {
    it('re-adds only the MIDI half after replaceTrackClips updates audio in place', () => {
      const adapter = createToneAdapter();
      const mixedTrack = makeTrack('t1', [
        makeClip({ id: 'a1', startSample: 0, durationSamples: 44100 }),
        makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 }),
      ]);
      adapter.setTracks([mixedTrack]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addTrack).toHaveBeenCalledTimes(1);
      expect(instance.addMidiTrack).toHaveBeenCalledTimes(1);
      instance.replaceTrackClips.mockReturnValue(true);

      adapter.updateTrack!('t1', mixedTrack);

      // Audio updated in place — NOT re-added (a second addTrack would leak
      // the old ToneTrack; TonePlayout.addTrack has no idempotency guard)
      expect(instance.addTrack).toHaveBeenCalledTimes(1);
      // MIDI half removed and re-added
      expect(instance.removeTrack).toHaveBeenCalledWith('t1:midi');
      expect(instance.addMidiTrack).toHaveBeenCalledTimes(2);
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

    it('secondsToTicks converts using current BPM and ppqn', () => {
      const adapter = createToneAdapter();
      expect(adapter.secondsToTicks!(1.0)).toBeCloseTo(384);
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

    it('uses :midi suffixed id for mixed audio+MIDI tracks', () => {
      const adapter = createToneAdapter();
      adapter.setTracks([
        makeTrack('t1', [
          makeClip({ id: 'a1', startSample: 0, durationSamples: 44100 }),
          makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 }),
        ]),
      ]);

      adapter.setSoundFontCache(loadedCache);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.removeTrack).toHaveBeenCalledWith('t1:midi');
      expect(instance.addSoundFontTrack.mock.calls[0][0].track.id).toBe('t1:midi');
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

    it('uses :midi suffixed id for tracks with both audio and MIDI clips', () => {
      const adapter = createToneAdapter({ soundFontCache: loadedCache });
      adapter.setTracks([
        makeTrack('t1', [
          makeClip({ id: 'a1', startSample: 0, durationSamples: 44100 }),
          makeMidiClip({ id: 'm1', startSample: 0, durationSamples: 44100 }),
        ]),
      ]);

      const instance = (TonePlayout as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(instance.addTrack.mock.calls[0][0].track.id).toBe('t1');
      expect(instance.addSoundFontTrack.mock.calls[0][0].track.id).toBe('t1:midi');
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
});
