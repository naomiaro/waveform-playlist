import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock TonePlayout before importing adapter
vi.mock('../TonePlayout', () => {
  return {
    TonePlayout: vi.fn().mockImplementation(() => ({
      init: vi.fn().mockResolvedValue(undefined),
      addTrack: vi.fn(),
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

import { createToneAdapter } from '../TonePlayoutAdapter';
import { TonePlayout } from '../TonePlayout';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';

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
    it('play() before setTracks is a no-op (isPlaying stays false)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const adapter = createToneAdapter();
      adapter.play(0);
      expect(adapter.isPlaying()).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('adapter.play() called but no playout is available')
      );
      warnSpy.mockRestore();
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

    it('throws if called before setTracks', () => {
      const adapter = createToneAdapter();

      const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });

      expect(() => adapter.addTrack!(makeTrack('t1', [clip]))).toThrow('no playout exists');
    });
  });
});
