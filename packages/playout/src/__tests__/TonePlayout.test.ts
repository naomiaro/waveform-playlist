import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted runs before vi.mock hoisting, making these available in mock factories
const { mockTransport, mockVolume } = vi.hoisted(() => ({
  mockTransport: {
    stop: vi.fn(),
    off: vi.fn(),
    clear: vi.fn(),
    schedule: vi.fn().mockReturnValue(1),
    cancel: vi.fn(),
    start: vi.fn(),
    seconds: 0,
    state: 'stopped' as string,
    loop: false,
    loopStart: 0,
    loopEnd: 0,
  },
  mockVolume: {
    volume: { value: 0 },
    toDestination: vi.fn(),
    dispose: vi.fn(),
    input: {},
  },
}));

vi.mock('tone', () => ({
  Volume: vi.fn().mockImplementation(() => mockVolume),
  getTransport: vi.fn().mockReturnValue(mockTransport),
  getDestination: vi.fn(),
  getContext: vi.fn().mockReturnValue({ sampleRate: 44100 }),
  start: vi.fn().mockResolvedValue(undefined),
  now: vi.fn().mockReturnValue(0.1),
  ToneAudioNode: vi.fn(),
}));

// Mock track classes — we only need PlayableTrack interface
vi.mock('../ToneTrack', () => ({
  ToneTrack: vi.fn(),
}));
vi.mock('../MidiToneTrack', () => ({
  MidiToneTrack: vi.fn(),
}));
vi.mock('../SoundFontToneTrack', () => ({
  SoundFontToneTrack: vi.fn(),
}));

import { TonePlayout } from '../TonePlayout';

function createMockTrack(id: string) {
  return {
    id,
    muted: false,
    stopAllSources: vi.fn(),
    cancelFades: vi.fn(),
    dispose: vi.fn(),
    setMute: vi.fn(),
    setSolo: vi.fn(),
    setVolume: vi.fn(),
    setPan: vi.fn(),
  };
}

describe('TonePlayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransport.state = 'stopped';
  });

  describe('dispose', () => {
    it('stops the Transport', () => {
      const playout = new TonePlayout();
      playout.dispose();

      expect(mockTransport.stop).toHaveBeenCalled();
    });

    it('stops all active sources on each track', () => {
      const playout = new TonePlayout();
      const track1 = createMockTrack('t1');
      const track2 = createMockTrack('t2');
      // Access private tracks map to inject mock tracks
      (playout as unknown as { tracks: Map<string, unknown> }).tracks.set('t1', track1);
      (playout as unknown as { tracks: Map<string, unknown> }).tracks.set('t2', track2);

      playout.dispose();

      expect(track1.stopAllSources).toHaveBeenCalled();
      expect(track2.stopAllSources).toHaveBeenCalled();
    });

    it('cancels fades on each track', () => {
      const playout = new TonePlayout();
      const track = createMockTrack('t1');
      (playout as unknown as { tracks: Map<string, unknown> }).tracks.set('t1', track);

      playout.dispose();

      expect(track.cancelFades).toHaveBeenCalled();
    });

    it('removes loop handler from Transport', () => {
      const playout = new TonePlayout();
      const handler = vi.fn();
      (playout as unknown as { _loopHandler: (() => void) | null })._loopHandler = handler;

      playout.dispose();

      expect(mockTransport.off).toHaveBeenCalledWith('loop', handler);
    });

    it('disposes tracks after stopping them', () => {
      const playout = new TonePlayout();
      const track = createMockTrack('t1');
      (playout as unknown as { tracks: Map<string, unknown> }).tracks.set('t1', track);

      playout.dispose();

      // stop() is called first (stopAllSources + cancelFades), then dispose()
      expect(track.stopAllSources).toHaveBeenCalled();
      expect(track.dispose).toHaveBeenCalled();
    });

    it('clears the tracks map', () => {
      const playout = new TonePlayout();
      const track = createMockTrack('t1');
      const tracks = (playout as unknown as { tracks: Map<string, unknown> }).tracks;
      tracks.set('t1', track);

      playout.dispose();

      expect(tracks.size).toBe(0);
    });

    it('disposes master volume', () => {
      const playout = new TonePlayout();
      playout.dispose();

      expect(mockVolume.dispose).toHaveBeenCalled();
    });

    it('completes full cleanup even if stop() throws', () => {
      mockTransport.stop.mockImplementationOnce(() => {
        throw new Error('Transport error');
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const playout = new TonePlayout();
      const track = createMockTrack('t1');
      (playout as unknown as { tracks: Map<string, unknown> }).tracks.set('t1', track);

      playout.dispose();

      // Track should still be disposed despite Transport.stop() throwing
      expect(track.dispose).toHaveBeenCalled();
      expect(mockVolume.dispose).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Transport.stop() failed'),
        expect.any(Error)
      );
      warnSpy.mockRestore();
    });

    it('completes full cleanup even if stopAllSources throws on a track', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const playout = new TonePlayout();
      const track1 = createMockTrack('t1');
      const track2 = createMockTrack('t2');
      track1.stopAllSources.mockImplementation(() => {
        throw new Error('source error');
      });
      (playout as unknown as { tracks: Map<string, unknown> }).tracks.set('t1', track1);
      (playout as unknown as { tracks: Map<string, unknown> }).tracks.set('t2', track2);

      playout.dispose();

      // track2 should still get stopAllSources called despite track1 throwing
      expect(track2.stopAllSources).toHaveBeenCalled();
      // Both tracks should still be disposed
      expect(track1.dispose).toHaveBeenCalled();
      expect(track2.dispose).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('clears completion event', () => {
      const playout = new TonePlayout();
      (playout as unknown as { _completionEventId: number | null })._completionEventId = 42;

      playout.dispose();

      expect(mockTransport.clear).toHaveBeenCalledWith(42);
    });

    it('calls effects cleanup', () => {
      const effectsCleanup = vi.fn();
      const playout = new TonePlayout();
      (playout as unknown as { effectsCleanup?: () => void }).effectsCleanup = effectsCleanup;

      playout.dispose();

      expect(effectsCleanup).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('stops the Transport', () => {
      const playout = new TonePlayout();
      playout.stop();

      expect(mockTransport.stop).toHaveBeenCalled();
    });

    it('continues cleanup when stopAllSources throws on one track', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const playout = new TonePlayout();
      const track1 = createMockTrack('t1');
      const track2 = createMockTrack('t2');
      track1.stopAllSources.mockImplementation(() => {
        throw new Error('source error');
      });
      (playout as unknown as { tracks: Map<string, unknown> }).tracks.set('t1', track1);
      (playout as unknown as { tracks: Map<string, unknown> }).tracks.set('t2', track2);

      playout.stop();

      expect(track2.stopAllSources).toHaveBeenCalled();
      expect(track1.cancelFades).toHaveBeenCalled();
      expect(track2.cancelFades).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('continues cleanup when cancelFades throws on one track', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const playout = new TonePlayout();
      const track1 = createMockTrack('t1');
      const track2 = createMockTrack('t2');
      track1.cancelFades.mockImplementation(() => {
        throw new Error('fade error');
      });
      (playout as unknown as { tracks: Map<string, unknown> }).tracks.set('t1', track1);
      (playout as unknown as { tracks: Map<string, unknown> }).tracks.set('t2', track2);

      playout.stop();

      expect(track2.cancelFades).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('removes loop handler and nulls it', () => {
      const playout = new TonePlayout();
      const handler = vi.fn();
      (playout as unknown as { _loopHandler: (() => void) | null })._loopHandler = handler;

      playout.stop();

      expect(mockTransport.off).toHaveBeenCalledWith('loop', handler);
      expect((playout as unknown as { _loopHandler: (() => void) | null })._loopHandler).toBeNull();
    });

    it('skips loop handler removal when none is set', () => {
      const playout = new TonePlayout();
      playout.stop();

      expect(mockTransport.off).not.toHaveBeenCalledWith('loop', expect.anything());
    });
  });
});
