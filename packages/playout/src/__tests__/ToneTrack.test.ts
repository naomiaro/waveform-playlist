import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Tone.js
const mockTransport = {
  schedule: vi.fn().mockReturnValue(1),
  clear: vi.fn(),
  seconds: 0,
  state: 'stopped' as string,
};

const mockGainNode = {
  gain: { value: 1, cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn() },
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const mockContext = {
  rawContext: {
    createGain: vi.fn(() => ({ ...mockGainNode })),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
      onended: null,
    })),
  },
  currentTime: 0,
  lookAhead: 0.1,
  sampleRate: 48000,
};

const mockVolume = {
  input: { input: { nodeType: 1 } }, // native GainNode mock
  chain: vi.fn(),
  dispose: vi.fn(),
  volume: { value: 0 },
};

const mockPanner = {
  pan: { value: 0 },
  dispose: vi.fn(),
};

const mockMuteGain = {
  gain: { value: 1 },
  connect: vi.fn(),
  dispose: vi.fn(),
};

vi.mock('tone', () => ({
  Volume: vi.fn(() => mockVolume),
  Panner: vi.fn(() => mockPanner),
  Gain: vi.fn(() => mockMuteGain),
  getTransport: vi.fn(() => mockTransport),
  getContext: vi.fn(() => mockContext),
  getDestination: vi.fn(() => ({})),
  ToneAudioNode: class {},
}));

vi.mock('../fades', () => ({
  applyFadeIn: vi.fn(),
  applyFadeOut: vi.fn(),
  getUnderlyingAudioParam: vi.fn(() => ({
    setValueAtTime: vi.fn(),
  })),
}));

import { ToneTrack } from '../ToneTrack';
import type { ClipInfo } from '../ToneTrack';
import type { Track } from '@waveform-playlist/core';

function makeBuffer(length = 48000): AudioBuffer {
  return { length, duration: length / 48000, sampleRate: 48000 } as any;
}

function makeClipInfo(overrides: Partial<ClipInfo> = {}): ClipInfo {
  return {
    buffer: makeBuffer(),
    startTime: 0,
    duration: 1,
    offset: 0,
    gain: 1,
    ...overrides,
  };
}

function makeTrack(id = 't1'): Track {
  return {
    id,
    name: 'Test',
    gain: 1,
    muted: false,
    soloed: false,
    stereoPan: 0,
    startTime: 0,
    endTime: 1,
  };
}

describe('ToneTrack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransport.seconds = 0;
    mockTransport.state = 'stopped';
    mockContext.currentTime = 0;
    mockContext.lookAhead = 0.1;
  });

  describe('replaceClips', () => {
    it('keeps unchanged clips and their Transport events', () => {
      const clip1 = makeClipInfo({ startTime: 0, duration: 1 });
      const clip2 = makeClipInfo({ startTime: 1, duration: 1 });
      const track = new ToneTrack({
        clips: [clip1, clip2],
        track: makeTrack(),
      });

      // 2 clips scheduled
      expect(mockTransport.schedule).toHaveBeenCalledTimes(2);
      mockTransport.clear.mockClear();

      // Replace with same clips — nothing should change
      track.replaceClips([clip1, clip2]);

      expect(mockTransport.clear).not.toHaveBeenCalled();
      // No new schedules (2 kept, 0 added)
      expect(mockTransport.schedule).toHaveBeenCalledTimes(2);
    });

    it('removes changed clips and adds new ones', () => {
      const clip1 = makeClipInfo({ startTime: 0, duration: 1 });
      const clip2 = makeClipInfo({ startTime: 1, duration: 1 });
      const track = new ToneTrack({
        clips: [clip1, clip2],
        track: makeTrack(),
      });

      expect(mockTransport.schedule).toHaveBeenCalledTimes(2);
      mockTransport.schedule.mockClear();

      // Replace clip2 with a trimmed version (different duration)
      const clip2Trimmed = makeClipInfo({ startTime: 1, duration: 0.5, buffer: clip2.buffer });
      track.replaceClips([clip1, clip2Trimmed]);

      // clip1 kept (no clear), clip2 cleared + new one scheduled
      expect(mockTransport.clear).toHaveBeenCalledTimes(1);
      expect(mockTransport.schedule).toHaveBeenCalledTimes(1);
    });

    it('removes clips not in the new list', () => {
      const clip1 = makeClipInfo({ startTime: 0, duration: 1 });
      const clip2 = makeClipInfo({ startTime: 1, duration: 1 });
      const track = new ToneTrack({
        clips: [clip1, clip2],
        track: makeTrack(),
      });

      mockTransport.clear.mockClear();

      // Replace with only clip1
      track.replaceClips([clip1]);

      // clip2 should be cleared
      expect(mockTransport.clear).toHaveBeenCalledTimes(1);
    });

    it('starts mid-clip source for new clip during playback', () => {
      const clip1 = makeClipInfo({ startTime: 0, duration: 2 });
      const track = new ToneTrack({
        clips: [clip1],
        track: makeTrack(),
      });

      mockTransport.schedule.mockClear();

      // Simulate mid-playback
      mockTransport.state = 'started';
      mockTransport.seconds = 1.0; // Transport at 1s
      mockContext.currentTime = 5.0; // AudioContext time

      // Replace with a different clip that spans position 1.0
      const newClip = makeClipInfo({ startTime: 0, duration: 2, offset: 0.1 });
      track.replaceClips([newClip]);

      // Should schedule new clip + start a mid-clip source
      expect(mockTransport.schedule).toHaveBeenCalledTimes(1);
      const createBufferSource = mockContext.rawContext.createBufferSource;
      expect(createBufferSource).toHaveBeenCalled();
    });

    it('accounts for lookAhead when starting mid-clip source', () => {
      const clip = makeClipInfo({ startTime: 0, duration: 2, offset: 0 });
      const track = new ToneTrack({
        clips: [clip],
        track: makeTrack(),
      });

      mockTransport.schedule.mockClear();
      mockContext.rawContext.createBufferSource.mockClear();

      // Simulate mid-playback: Transport at 1.0s, lookAhead 0.1s
      // Audible position = 1.0 - 0.1 = 0.9s
      mockTransport.state = 'started';
      mockTransport.seconds = 1.0;
      mockContext.currentTime = 5.0;
      mockContext.lookAhead = 0.1;

      // Replace with a modified clip
      const newClip = makeClipInfo({ startTime: 0, duration: 2, offset: 0.05 });
      track.replaceClips([newClip]);

      // Source should start — verify it was created
      const createBufferSource = mockContext.rawContext.createBufferSource;
      expect(createBufferSource).toHaveBeenCalled();

      // The source.start() call should use audible offset (0.9s elapsed, not 1.0s)
      const source = createBufferSource.mock.results[0]?.value;
      expect(source).toBeTruthy();
      const [time, offset, duration] = source.start.mock.calls[0];
      expect(time).toBe(5.0);
      // offset = clipInfo.offset + elapsed = 0.05 + 0.9 = 0.95
      expect(offset).toBeCloseTo(0.95, 10);
      // duration = clipInfo.duration - elapsed = 2 - 0.9 = 1.1
      expect(duration).toBeCloseTo(1.1, 10);
    });

    it('does not start mid-clip source when Transport is stopped', () => {
      const clip = makeClipInfo({ startTime: 0, duration: 2 });
      const track = new ToneTrack({
        clips: [clip],
        track: makeTrack(),
      });

      mockContext.rawContext.createBufferSource.mockClear();
      mockTransport.state = 'stopped';

      const newClip = makeClipInfo({ startTime: 0, duration: 1.5 });
      track.replaceClips([newClip]);

      // No mid-clip source — only the constructor's initial source creation
      // and the new schedule callback (not yet fired)
      const callCount = mockContext.rawContext.createBufferSource.mock.calls.length;
      expect(callCount).toBe(0);
    });

    it('uses buffer reference equality, not length', () => {
      const buf1 = makeBuffer(48000);
      const buf2 = makeBuffer(48000); // same length, different object
      const clip1 = makeClipInfo({ buffer: buf1, startTime: 0, duration: 1 });
      const track = new ToneTrack({
        clips: [clip1],
        track: makeTrack(),
      });

      mockTransport.clear.mockClear();
      mockTransport.schedule.mockClear();

      // Replace with same timing but different buffer — should NOT match
      const clip2 = makeClipInfo({ buffer: buf2, startTime: 0, duration: 1 });
      track.replaceClips([clip2]);

      // Old clip cleared, new clip scheduled
      expect(mockTransport.clear).toHaveBeenCalledTimes(1);
      expect(mockTransport.schedule).toHaveBeenCalledTimes(1);
    });
  });

  describe('addClip', () => {
    it('schedules a new clip on the Transport', () => {
      const track = new ToneTrack({
        clips: [],
        track: makeTrack(),
      });

      mockTransport.schedule.mockClear();
      const clip = makeClipInfo({ startTime: 0.5, duration: 1 });
      track.addClip(clip);

      expect(mockTransport.schedule).toHaveBeenCalledTimes(1);
      // Absolute time = track.startTime (0) + clip.startTime (0.5) = 0.5
      expect(mockTransport.schedule).toHaveBeenCalledWith(expect.any(Function), 0.5);
    });
  });

  describe('removeScheduledClip', () => {
    it('clears Transport event and disconnects fadeGainNode', () => {
      const clip = makeClipInfo();
      const track = new ToneTrack({
        clips: [clip],
        track: makeTrack(),
      });

      mockTransport.clear.mockClear();
      track.removeScheduledClip(0);

      expect(mockTransport.clear).toHaveBeenCalledTimes(1);
    });

    it('is a no-op for out-of-bounds index', () => {
      const track = new ToneTrack({
        clips: [],
        track: makeTrack(),
      });

      // Should not throw
      track.removeScheduledClip(5);
      expect(mockTransport.clear).not.toHaveBeenCalled();
    });
  });
});
