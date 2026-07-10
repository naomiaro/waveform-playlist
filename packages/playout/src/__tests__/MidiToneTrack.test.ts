import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Tone.js before importing MidiToneTrack
const mockReleaseAll = vi.fn();
const mockTriggerAttackRelease = vi.fn();
const mockSynthConnect = vi.fn();
const mockSynthDispose = vi.fn();

// Separate mocks for percussion synths to verify per-note routing
const mockPercTriggerAttackRelease = vi.fn();
const mockPercReleaseAll = vi.fn();
const mockPercConnect = vi.fn();
const mockPercDispose = vi.fn();

// NoiseSynth (monophonic, not wrapped in PolySynth)
const mockNoiseTriggerAttackRelease = vi.fn();
const mockNoiseConnect = vi.fn();
const mockNoiseDispose = vi.fn();

const mockPartStart = vi.fn();
const mockPartDispose = vi.fn();
const mockPartInstances: Array<{
  callback: (...args: unknown[]) => void;
  events: unknown[];
  start: typeof mockPartStart;
  dispose: typeof mockPartDispose;
}> = [];

const mockVolumeChain = vi.fn();
const mockVolumeDispose = vi.fn();
const mockGainDispose = vi.fn();
const mockPannerDispose = vi.fn();
const mockMuteGainValue = { value: 1 };
const mockMuteGainGain = { ...mockMuteGainValue, value: 1 };
const mockConnect = vi.fn();

// Track which PolySynth gets which voice class to differentiate melodic vs percussion
let polySynthCallCount = 0;

vi.mock('tone', () => ({
  PolySynth: vi.fn().mockImplementation(() => {
    polySynthCallCount++;
    // First call = melodic synth, subsequent = percussion PolySynth wrappers
    if (polySynthCallCount === 1) {
      return {
        connect: mockSynthConnect,
        releaseAll: mockReleaseAll,
        triggerAttackRelease: mockTriggerAttackRelease,
        dispose: mockSynthDispose,
      };
    }
    return {
      connect: mockPercConnect,
      releaseAll: mockPercReleaseAll,
      triggerAttackRelease: mockPercTriggerAttackRelease,
      dispose: mockPercDispose,
    };
  }),
  Synth: vi.fn(),
  MembraneSynth: vi.fn(),
  MetalSynth: vi.fn(),
  NoiseSynth: vi.fn().mockImplementation(() => ({
    connect: mockNoiseConnect,
    triggerAttackRelease: mockNoiseTriggerAttackRelease,
    dispose: mockNoiseDispose,
  })),
  Part: vi.fn().mockImplementation((callback: (...args: unknown[]) => void, events: unknown[]) => {
    const instance = {
      callback,
      events,
      start: mockPartStart.mockReturnThis(),
      dispose: mockPartDispose,
    };
    mockPartInstances.push(instance);
    return instance;
  }),
  Volume: vi.fn().mockImplementation(() => ({
    chain: mockVolumeChain,
    dispose: mockVolumeDispose,
    volume: { value: 0 },
  })),
  Gain: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    dispose: mockGainDispose,
    gain: mockMuteGainGain,
  })),
  Panner: vi.fn().mockImplementation(() => ({
    dispose: mockPannerDispose,
    pan: { value: 0 },
  })),
  ToneAudioNode: vi.fn(),
  getDestination: vi.fn().mockReturnValue({}),
  getContext: vi.fn().mockReturnValue({
    rawContext: { currentTime: 0 },
  }),
}));

// Mock fades utility
vi.mock('../fades', () => ({
  getUnderlyingAudioParam: vi.fn().mockReturnValue({
    setValueAtTime: vi.fn(),
  }),
}));

import { MidiToneTrack } from '../MidiToneTrack';
import type { MidiClipInfo, MidiToneTrackOptions } from '../MidiToneTrack';
import type { Track } from '@waveform-playlist/core';

function makeTrack(overrides?: Partial<Track>): Track {
  return {
    id: 'midi-track-1',
    name: 'MIDI Track',
    gain: 1,
    muted: false,
    soloed: false,
    stereoPan: 0,
    startTime: 0,
    ...overrides,
  };
}

function makeMidiClip(overrides?: Partial<MidiClipInfo>): MidiClipInfo {
  return {
    notes: [
      { midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 },
      { midi: 64, name: 'E4', time: 0.5, duration: 0.5, velocity: 0.6 },
      { midi: 67, name: 'G4', time: 1.0, duration: 0.5, velocity: 0.7 },
    ],
    startTime: 0,
    duration: 1.5,
    offset: 0,
    ...overrides,
  };
}

function createTrack(options?: Partial<MidiToneTrackOptions>): MidiToneTrack {
  return new MidiToneTrack({
    clips: [makeMidiClip()],
    track: makeTrack(),
    ...options,
  });
}

describe('MidiToneTrack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPartInstances.length = 0;
    mockMuteGainGain.value = 1;
    polySynthCallCount = 0;
  });

  describe('construction', () => {
    it('creates melodic and percussion synths, connects to Volume node', () => {
      createTrack();

      // Melodic PolySynth connects
      expect(mockSynthConnect).toHaveBeenCalled();
      // Percussion synths connect (kick, snare, cymbal, tom)
      expect(mockPercConnect).toHaveBeenCalled();
      expect(mockNoiseConnect).toHaveBeenCalled();
      expect(mockVolumeChain).toHaveBeenCalled();
    });

    it('creates a Part for each clip', () => {
      createTrack({
        clips: [makeMidiClip(), makeMidiClip({ startTime: 2 })],
        track: makeTrack(),
      });

      expect(mockPartInstances).toHaveLength(2);
      expect(mockPartStart).toHaveBeenCalledTimes(2);
    });

    it('schedules note events in the Part', () => {
      createTrack();

      expect(mockPartInstances).toHaveLength(1);
      const partEvents = mockPartInstances[0].events;
      expect(partEvents).toHaveLength(3);

      // First note: C4 at time 0
      expect(partEvents[0]).toMatchObject({
        time: 0,
        note: 'C4',
        duration: 0.5,
        velocity: 0.8,
      });
    });

    it('offsets note times by track.startTime + clip.startTime', () => {
      createTrack({
        clips: [makeMidiClip({ startTime: 1.0 })],
        track: makeTrack({ startTime: 2.0 }),
      });

      const partEvents = mockPartInstances[0].events;
      // First note at time 0 + track.startTime(2.0) + clip.startTime(1.0) = 3.0
      expect(partEvents[0]).toMatchObject({ time: 3.0 });
    });

    it('connects to destination when no effects provided', () => {
      createTrack();
      expect(mockConnect).toHaveBeenCalled();
    });

    it('applies effects chain when provided', () => {
      const effectsFn = vi.fn().mockReturnValue(() => {});
      createTrack({ effects: effectsFn });
      expect(effectsFn).toHaveBeenCalled();
    });
  });

  describe('trim offset filtering', () => {
    it('filters notes outside clip offset window', () => {
      createTrack({
        clips: [
          makeMidiClip({
            notes: [
              { midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 },
              { midi: 64, name: 'E4', time: 1.0, duration: 0.5, velocity: 0.6 },
              { midi: 67, name: 'G4', time: 2.0, duration: 0.5, velocity: 0.7 },
            ],
            offset: 0.8,
            duration: 1.0,
          }),
        ],
        track: makeTrack(),
      });

      const partEvents = mockPartInstances[0].events;
      // Note at time 0 (ends at 0.5) is before offset 0.8 — excluded
      // Note at time 1.0 is within [0.8, 1.8] — included
      // Note at time 2.0 is after offset + duration (1.8) — excluded
      expect(partEvents).toHaveLength(1);
      expect(partEvents[0]).toMatchObject({ note: 'E4' });
    });
  });

  describe('getters', () => {
    it('returns track id', () => {
      const track = createTrack({ track: makeTrack({ id: 'test-id' }) });
      expect(track.id).toBe('test-id');
    });

    it('returns duration from clips', () => {
      const track = createTrack({
        clips: [makeMidiClip({ startTime: 0, duration: 1.5 })],
      });
      expect(track.duration).toBe(1.5);
    });

    it('returns 0 duration for no clips', () => {
      const track = createTrack({ clips: [] });
      expect(track.duration).toBe(0);
    });

    it('returns muted state', () => {
      const track = createTrack({ track: makeTrack({ muted: true }) });
      expect(track.muted).toBe(true);
    });

    it('returns startTime', () => {
      const track = createTrack({ track: makeTrack({ startTime: 5.0 }) });
      expect(track.startTime).toBe(5.0);
    });
  });

  describe('stopAllSources', () => {
    it('calls releaseAll on melodic and percussion PolySynths', () => {
      const track = createTrack();
      track.stopAllSources();
      // Melodic synth
      expect(mockReleaseAll).toHaveBeenCalledWith(0);
      // Percussion PolySynths (kick, cymbal, tom)
      expect(mockPercReleaseAll).toHaveBeenCalledWith(0);
    });
  });

  describe('volume/pan/mute/solo controls', () => {
    it('setVolume updates volume node', () => {
      const track = createTrack();
      track.setVolume(0.5);
      // Verify the track accepted the volume change without error
      // (gainToDb converts 0.5 to ≈ -6.02 dB internally)
      expect(() => track.setVolume(0.5)).not.toThrow();
    });

    it('setPan updates pan node', () => {
      const track = createTrack();
      track.setPan(-0.5);
      // Verify the track accepted the pan change without error
      expect(() => track.setPan(-0.5)).not.toThrow();
    });

    it('setMute sets gain to 0 when muted', () => {
      const track = createTrack();
      track.setMute(true);
      expect(mockMuteGainGain.value).toBe(0);
    });

    it('setMute sets gain to 1 when unmuted', () => {
      const track = createTrack({ track: makeTrack({ muted: true }) });
      track.setMute(false);
      expect(mockMuteGainGain.value).toBe(1);
    });

    it('setSolo updates track state', () => {
      const trackObj = makeTrack();
      const track = createTrack({ track: trackObj });
      track.setSolo(true);
      expect(trackObj.soloed).toBe(true);
    });
  });

  describe('no-op methods', () => {
    it('prepareFades is a no-op', () => {
      const track = createTrack();
      expect(() => track.prepareFades(0, 0)).not.toThrow();
    });

    it('cancelFades is a no-op', () => {
      const track = createTrack();
      expect(() => track.cancelFades()).not.toThrow();
    });

    it('setScheduleGuardOffset is a no-op', () => {
      const track = createTrack();
      expect(() => track.setScheduleGuardOffset(5)).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('releases all notes', () => {
      const track = createTrack();
      track.dispose();
      expect(mockReleaseAll).toHaveBeenCalled();
    });

    it('disposes all Parts', () => {
      createTrack({
        clips: [makeMidiClip(), makeMidiClip({ startTime: 2 })],
        track: makeTrack(),
      });

      const track = new MidiToneTrack({
        clips: [makeMidiClip()],
        track: makeTrack(),
      });
      // Clear mocks from constructor calls, then dispose
      mockPartDispose.mockClear();
      track.dispose();

      expect(mockPartDispose).toHaveBeenCalled();
    });

    it('disposes all synths and audio nodes', () => {
      const track = createTrack();
      track.dispose();

      // Melodic PolySynth
      expect(mockSynthDispose).toHaveBeenCalled();
      // Percussion PolySynths (kick, cymbal, tom)
      expect(mockPercDispose).toHaveBeenCalled();
      // NoiseSynth (snare)
      expect(mockNoiseDispose).toHaveBeenCalled();
      // Audio nodes
      expect(mockVolumeDispose).toHaveBeenCalled();
      expect(mockPannerDispose).toHaveBeenCalled();
      expect(mockGainDispose).toHaveBeenCalled();
    });

    it('calls effects cleanup on dispose', () => {
      const cleanup = vi.fn();
      const effectsFn = vi.fn().mockReturnValue(cleanup);
      const track = createTrack({ effects: effectsFn });
      track.dispose();
      expect(cleanup).toHaveBeenCalled();
    });
  });

  describe('percussion routing', () => {
    it('routes channel 9 notes to percussion synths', () => {
      createTrack({
        clips: [
          makeMidiClip({
            notes: [
              // Channel 9 kick drum (note 36)
              { midi: 36, name: 'C2', time: 0, duration: 0.1, velocity: 0.9, channel: 9 },
              // Channel 9 snare (note 38)
              { midi: 38, name: 'D2', time: 0.25, duration: 0.1, velocity: 0.8, channel: 9 },
              // Channel 9 hi-hat (note 42)
              { midi: 42, name: 'F#2', time: 0.5, duration: 0.06, velocity: 0.7, channel: 9 },
              // Non-percussion note (channel 0)
              { midi: 60, name: 'C4', time: 0, duration: 1.0, velocity: 0.8, channel: 0 },
            ],
            startTime: 0,
            duration: 1.0,
            offset: 0,
          }),
        ],
        track: makeTrack(),
      });

      // Trigger all notes via the Part callback
      const part = mockPartInstances[0];
      for (const event of part.events as Array<{
        time: number;
        note: string;
        midi: number;
        duration: number;
        velocity: number;
        channel?: number;
      }>) {
        part.callback(event.time, event);
      }

      // Channel 0 note → melodic synth
      expect(mockTriggerAttackRelease).toHaveBeenCalledWith(
        'C4',
        expect.any(Number),
        expect.any(Number),
        expect.any(Number)
      );

      // Channel 9 notes → percussion synths (kick/cymbal use PolySynth mocks)
      expect(mockPercTriggerAttackRelease).toHaveBeenCalled();
    });
  });

  describe('startMidClipSources', () => {
    it('triggers notes that should be sounding at given offset', () => {
      const track = createTrack({
        clips: [
          makeMidiClip({
            notes: [
              { midi: 60, name: 'C4', time: 0, duration: 1.0, velocity: 0.8 },
              { midi: 64, name: 'E4', time: 0.5, duration: 1.0, velocity: 0.6 },
            ],
            startTime: 0,
            duration: 2.0,
            offset: 0,
          }),
        ],
        track: makeTrack({ startTime: 0 }),
      });

      // Transport at 0.7s — both notes should be sounding
      // C4: started at 0, ends at 1.0, remaining = 0.3
      // E4: started at 0.5, ends at 1.5, remaining = 0.8
      track.startMidClipSources(0.7, 0.1);

      expect(mockTriggerAttackRelease).toHaveBeenCalledTimes(2);
      expect(mockTriggerAttackRelease).toHaveBeenCalledWith('C4', expect.closeTo(0.3, 1), 0.1, 0.8);
      expect(mockTriggerAttackRelease).toHaveBeenCalledWith('E4', expect.closeTo(0.8, 1), 0.1, 0.6);
    });

    it('does not trigger notes outside the transport offset', () => {
      const track = createTrack({
        clips: [
          makeMidiClip({
            notes: [
              { midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 },
              { midi: 64, name: 'E4', time: 2.0, duration: 0.5, velocity: 0.6 },
            ],
            startTime: 0,
            duration: 3.0,
            offset: 0,
          }),
        ],
        track: makeTrack({ startTime: 0 }),
      });

      // Transport at 1.0 — C4 ended at 0.5, E4 starts at 2.0
      track.startMidClipSources(1.0, 0.1);
      expect(mockTriggerAttackRelease).not.toHaveBeenCalled();
    });
  });

  describe('stopAllSources resilience', () => {
    it('releases percussion synths even when the melodic releaseAll throws', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const track = createTrack();
      mockReleaseAll.mockImplementationOnce(() => {
        throw new Error('already disposed');
      });

      track.stopAllSources();

      // A melodic failure must not leave percussion voices stuck —
      // stopAllSources runs on every stop() and loop boundary.
      expect(mockPercReleaseAll).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('duration', () => {
    it('returns the max clip end time regardless of array order', () => {
      const track = createTrack({
        clips: [
          makeMidiClip({ startTime: 0, duration: 10 }),
          makeMidiClip({ startTime: 2, duration: 2 }), // array-last ends at 4
        ],
      });

      expect(track.duration).toBe(10);
    });
  });
});
