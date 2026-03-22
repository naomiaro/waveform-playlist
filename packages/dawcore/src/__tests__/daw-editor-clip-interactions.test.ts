import { describe, it, expect, vi } from 'vitest';
import { splitAtPlayhead } from '../interactions/split-handler';
import type { SplitHost } from '../interactions/split-handler';
import type { AudioClip, ClipTrack } from '@waveform-playlist/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClip(id: string, startSample: number, durationSamples: number): AudioClip {
  return {
    id,
    startSample,
    durationSamples,
    offsetSamples: 0,
    name: 'test-clip',
    gain: 1,
    fadeIn: 0,
    fadeOut: 0,
    fadeType: 'linear',
    sampleRate: 48000,
    sourceDurationSamples: durationSamples,
  } as unknown as AudioClip;
}

function makeTrack(id: string, clips: AudioClip[]): ClipTrack {
  return {
    id,
    clips,
    gain: 1,
    stereoPan: 0,
    volume: 1,
    pan: 0,
    muted: false,
    soloed: false,
    name: 'test-track',
  } as unknown as ClipTrack;
}

function createMockHost(overrides: Partial<SplitHost> = {}): SplitHost & { events: CustomEvent[] } {
  const events: CustomEvent[] = [];

  const host: SplitHost & { events: CustomEvent[] } = {
    effectiveSampleRate: 48000,
    currentTime: 0,
    engine: null,
    dispatchEvent: vi.fn((event: Event) => {
      events.push(event as CustomEvent);
      return true;
    }),
    events,
    ...overrides,
  };

  return host;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('splitAtPlayhead', () => {
  describe('guard conditions', () => {
    it('returns false when engine is null', () => {
      const host = createMockHost({ engine: null });
      expect(splitAtPlayhead(host)).toBe(false);
    });

    it('returns false when selectedTrackId is null', () => {
      const engine = {
        getState: vi.fn().mockReturnValue({ selectedTrackId: null, tracks: [] }),
        splitClip: vi.fn(),
      };
      const host = createMockHost({ engine });
      expect(splitAtPlayhead(host)).toBe(false);
    });

    it('returns false when no track matches selectedTrackId', () => {
      const engine = {
        getState: vi.fn().mockReturnValue({
          selectedTrackId: 'track-999',
          tracks: [makeTrack('track-1', [])],
        }),
        splitClip: vi.fn(),
      };
      const host = createMockHost({ engine });
      expect(splitAtPlayhead(host)).toBe(false);
    });

    it('returns false when playhead is not within any clip', () => {
      // Clip spans samples 0..47999 (1 second at 48000Hz)
      // currentTime = 100.0s → way past the clip
      const clip = makeClip('clip-1', 0, 48000);
      const track = makeTrack('track-1', [clip]);

      const engine = {
        getState: vi.fn().mockReturnValue({
          selectedTrackId: 'track-1',
          tracks: [track],
        }),
        splitClip: vi.fn(),
      };
      const host = createMockHost({
        engine,
        currentTime: 100.0,
        effectiveSampleRate: 48000,
      });

      expect(splitAtPlayhead(host)).toBe(false);
    });

    it('returns false when playhead is exactly at clip start (not strictly inside)', () => {
      // startSample=48000; atSample must be > startSample
      const clip = makeClip('clip-1', 48000, 48000);
      const track = makeTrack('track-1', [clip]);

      const engine = {
        getState: vi.fn().mockReturnValue({
          selectedTrackId: 'track-1',
          tracks: [track],
        }),
        splitClip: vi.fn(),
      };
      const host = createMockHost({
        engine,
        // currentTime = 1.0s → atSample = 48000 = clip.startSample (not > startSample)
        currentTime: 1.0,
        effectiveSampleRate: 48000,
      });

      expect(splitAtPlayhead(host)).toBe(false);
    });

    it('returns false when playhead is exactly at clip end (not strictly inside)', () => {
      // clip: startSample=0, durationSamples=48000 → end=48000
      // atSample must be < startSample + durationSamples
      const clip = makeClip('clip-1', 0, 48000);
      const track = makeTrack('track-1', [clip]);

      const engine = {
        getState: vi.fn().mockReturnValue({
          selectedTrackId: 'track-1',
          tracks: [track],
        }),
        splitClip: vi.fn(),
      };
      const host = createMockHost({
        engine,
        // currentTime = 1.0s → atSample = 48000 = end boundary (not < end)
        currentTime: 1.0,
        effectiveSampleRate: 48000,
      });

      expect(splitAtPlayhead(host)).toBe(false);
    });
  });

  describe('successful split', () => {
    it('returns true and dispatches daw-clip-split when split succeeds', () => {
      const originalClipId = 'clip-original';
      const leftClipId = 'clip-left';
      const rightClipId = 'clip-right';

      // clip spans 0..96000 (2 seconds); playhead at 1.0s → atSample=48000
      const originalClip = makeClip(originalClipId, 0, 96000);
      const trackBefore = makeTrack('track-1', [originalClip]);

      // After split: two new clips
      const leftClip = makeClip(leftClipId, 0, 48000);
      const rightClip = makeClip(rightClipId, 48000, 48000);
      const trackAfter = makeTrack('track-1', [leftClip, rightClip]);

      const engine = {
        getState: vi
          .fn()
          .mockReturnValueOnce({ selectedTrackId: 'track-1', tracks: [trackBefore] })
          .mockReturnValueOnce({ selectedTrackId: 'track-1', tracks: [trackAfter] }),
        splitClip: vi.fn(),
      };
      const host = createMockHost({
        engine,
        currentTime: 1.0,
        effectiveSampleRate: 48000,
      });

      const result = splitAtPlayhead(host);

      expect(result).toBe(true);
      expect(engine.splitClip).toHaveBeenCalledWith('track-1', originalClipId, 48000);

      expect(host.events).toHaveLength(1);
      const event = host.events[0];
      expect(event.type).toBe('daw-clip-split');
      expect(event.bubbles).toBe(true);
      expect(event.composed).toBe(true);
      expect(event.detail).toEqual({
        trackId: 'track-1',
        originalClipId,
        leftClipId,
        rightClipId,
      });
    });

    it('assigns left/right correctly based on startSample (lower = left)', () => {
      const originalClipId = 'clip-original';

      // Intentionally return right clip first (higher startSample) to verify sorting
      const rightClip = makeClip('clip-right', 48000, 48000);
      const leftClip = makeClip('clip-left', 0, 48000);

      const originalClip = makeClip(originalClipId, 0, 96000);
      const trackBefore = makeTrack('track-1', [originalClip]);
      const trackAfter = makeTrack('track-1', [rightClip, leftClip]); // right before left in array

      const engine = {
        getState: vi
          .fn()
          .mockReturnValueOnce({ selectedTrackId: 'track-1', tracks: [trackBefore] })
          .mockReturnValueOnce({ selectedTrackId: 'track-1', tracks: [trackAfter] }),
        splitClip: vi.fn(),
      };
      const host = createMockHost({
        engine,
        currentTime: 1.0,
        effectiveSampleRate: 48000,
      });

      splitAtPlayhead(host);

      const event = host.events[0];
      expect(event.detail.leftClipId).toBe('clip-left');
      expect(event.detail.rightClipId).toBe('clip-right');
    });

    it('calls engine.splitClip with correct sample from currentTime conversion', () => {
      // 44100Hz sample rate, currentTime=2.0s → atSample = 88200
      const clip = makeClip('clip-1', 0, 176400); // 4 seconds at 44100
      const track = makeTrack('track-1', [clip]);

      const leftClip = makeClip('clip-left', 0, 88200);
      const rightClip = makeClip('clip-right', 88200, 88200);
      const trackAfter = makeTrack('track-1', [leftClip, rightClip]);

      const engine = {
        getState: vi
          .fn()
          .mockReturnValueOnce({ selectedTrackId: 'track-1', tracks: [track] })
          .mockReturnValueOnce({ selectedTrackId: 'track-1', tracks: [trackAfter] }),
        splitClip: vi.fn(),
      };
      const host = createMockHost({
        engine,
        currentTime: 2.0,
        effectiveSampleRate: 44100,
      });

      splitAtPlayhead(host);

      expect(engine.splitClip).toHaveBeenCalledWith('track-1', 'clip-1', 88200);
    });

    it('daw-clip-split event has bubbles=true and composed=true', () => {
      const clip = makeClip('clip-1', 0, 96000);
      const track = makeTrack('track-1', [clip]);

      const leftClip = makeClip('clip-left', 0, 24000);
      const rightClip = makeClip('clip-right', 24000, 72000);
      const trackAfter = makeTrack('track-1', [leftClip, rightClip]);

      const engine = {
        getState: vi
          .fn()
          .mockReturnValueOnce({ selectedTrackId: 'track-1', tracks: [track] })
          .mockReturnValueOnce({ selectedTrackId: 'track-1', tracks: [trackAfter] }),
        splitClip: vi.fn(),
      };
      const host = createMockHost({
        engine,
        currentTime: 0.5,
        effectiveSampleRate: 48000,
      });

      splitAtPlayhead(host);

      const splitEvent = host.events[0] as CustomEvent;
      expect(splitEvent.bubbles).toBe(true);
      expect(splitEvent.composed).toBe(true);
    });
  });

  describe('engine no-op (state unchanged)', () => {
    it('returns false when splitClip no-ops (clip IDs unchanged)', () => {
      const clip = makeClip('clip-1', 0, 96000);
      const track = makeTrack('track-1', [clip]);

      // Same state before and after — engine no-oped
      const stateSnapshot = { selectedTrackId: 'track-1', tracks: [track] };

      const engine = {
        getState: vi.fn().mockReturnValueOnce(stateSnapshot).mockReturnValueOnce(stateSnapshot),
        splitClip: vi.fn(),
      };
      const host = createMockHost({
        engine,
        currentTime: 1.0,
        effectiveSampleRate: 48000,
      });

      const result = splitAtPlayhead(host);

      expect(result).toBe(false);
      expect(host.events).toHaveLength(0);
    });
  });
});
