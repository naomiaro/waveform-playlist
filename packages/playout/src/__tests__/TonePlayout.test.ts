import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Track } from '@waveform-playlist/core';

// vi.hoisted runs before vi.mock hoisting, making these available in mock factories
const { mockTransport, mockVolume, mockMasterTap } = vi.hoisted(() => {
  const mockMasterTap = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
    input: {},
  };
  return {
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
      connect: vi.fn(),
      chain: vi.fn(),
      dispose: vi.fn(),
      // nested `.input` stands in for the native GainNode behind Volume.input
      input: { input: {} },
    },
    mockMasterTap,
  };
});

vi.mock('tone', () => ({
  Volume: vi.fn().mockImplementation(() => mockVolume),
  Gain: vi.fn().mockImplementation(() => mockMasterTap),
  getTransport: vi.fn().mockReturnValue(mockTransport),
  getDestination: vi.fn(),
  getContext: vi.fn().mockReturnValue({ sampleRate: 44100 }),
  start: vi.fn().mockResolvedValue(undefined),
  now: vi.fn().mockReturnValue(0.1),
  ToneAudioNode: vi.fn(),
}));

// Mock track classes. Instances are built by assigning onto `this` (never
// returning an object literal) so `new ToneTrack(...)` keeps the mocked
// constructor's prototype — required for `track instanceof ToneTrack` checks
// in TonePlayout's effects-transport hooks to resolve correctly.
vi.mock('../ToneTrack', () => {
  const ToneTrack = vi.fn(function (
    this: Record<string, unknown>,
    options: { track: { id: string; muted?: boolean } }
  ) {
    this.id = options.track.id;
    this.muted = options.track.muted ?? false;
    this.connectEffects = vi.fn();
    this.disconnectEffects = vi.fn();
    this.stopAllSources = vi.fn();
    this.cancelFades = vi.fn();
    this.dispose = vi.fn();
    this.setMute = vi.fn();
    this.setSolo = vi.fn();
    this.setVolume = vi.fn();
    this.setPan = vi.fn();
  });
  return { ToneTrack };
});
vi.mock('../MidiToneTrack', () => {
  const MidiToneTrack = vi.fn(function (
    this: Record<string, unknown>,
    options: { track: { id: string; muted?: boolean } }
  ) {
    this.id = options.track.id;
    this.muted = options.track.muted ?? false;
    this.stopAllSources = vi.fn();
    this.cancelFades = vi.fn();
    this.dispose = vi.fn();
    this.setMute = vi.fn();
    this.setSolo = vi.fn();
    this.setVolume = vi.fn();
    this.setPan = vi.fn();
  });
  return { MidiToneTrack };
});
vi.mock('../SoundFontToneTrack', () => ({
  SoundFontToneTrack: vi.fn(),
}));

import { TonePlayout } from '../TonePlayout';

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

  describe('effects transport hooks', () => {
    it('connectTrackOutput delegates to the ToneTrack', () => {
      const playout = new TonePlayout();
      const track = playout.addTrack({ clips: [], track: makeTrack('t1') });
      const spy = vi.spyOn(track, 'connectEffects');
      const node = {} as AudioNode;

      playout.connectTrackOutput('t1', node);

      expect(spy).toHaveBeenCalledWith(node);
    });

    it('connectTrackOutput throws for unknown track ids', () => {
      const playout = new TonePlayout();

      expect(() => playout.connectTrackOutput('nope', {} as AudioNode)).toThrow(/unknown track/);
    });

    it('connectTrackOutput throws for MIDI tracks', () => {
      const playout = new TonePlayout();
      playout.addMidiTrack({ clips: [], track: makeTrack('m1') });

      expect(() => playout.connectTrackOutput('m1', {} as AudioNode)).toThrow(/MIDI/);
    });

    it('disconnectTrackOutput is a no-op for unknown ids', () => {
      const playout = new TonePlayout();

      expect(() => playout.disconnectTrackOutput('nope')).not.toThrow();
    });

    it('connectMasterOutput reroutes the master tap; disconnectMasterOutput restores it', () => {
      const playout = new TonePlayout();
      const node = { name: 'chain-in' } as unknown as AudioNode;

      playout.connectMasterOutput(node);

      expect(mockMasterTap.disconnect).toHaveBeenCalledTimes(1);
      expect(mockMasterTap.connect).toHaveBeenCalledWith(node);

      mockMasterTap.connect.mockClear();
      playout.disconnectMasterOutput();

      expect(mockMasterTap.disconnect).toHaveBeenCalledWith(node);
      expect(mockMasterTap.connect).toHaveBeenCalledTimes(1); // back to destination
    });

    it('masterBusInputNode returns the native gain behind masterVolume.input', () => {
      const playout = new TonePlayout();

      // mockVolume.input.input is the native GainNode stand-in in this file's mocks
      expect(playout.masterBusInputNode).toBe(mockVolume.input.input);
    });
  });

  describe('setMute during active solo', () => {
    it('keeps a non-soloed track silent when its manual mute is toggled off during solo', () => {
      const playout = new TonePlayout();
      playout.addTrack({ clips: [], track: makeTrack('a') });
      const trackB = playout.addTrack({ clips: [], track: makeTrack('b') });

      playout.setSolo('a', true); // B muted by updateSoloMuting
      (trackB.setMute as ReturnType<typeof vi.fn>).mockClear();

      // User toggles B's mute button off while A is still soloed.
      // Solo takes precedence: B must remain effectively muted.
      playout.setMute('b', false);

      expect(trackB.setMute).toHaveBeenCalledWith(true);
      expect(trackB.setMute).not.toHaveBeenCalledWith(false);
    });

    it('remembers the manual mute for when solo clears', () => {
      const playout = new TonePlayout();
      playout.addTrack({ clips: [], track: makeTrack('a') });
      const trackB = playout.addTrack({ clips: [], track: makeTrack('b') });

      playout.setSolo('a', true);
      playout.setMute('b', false); // stored, not audible yet
      (trackB.setMute as ReturnType<typeof vi.fn>).mockClear();

      playout.setSolo('a', false); // solo cleared — manual state applies

      expect(trackB.setMute).toHaveBeenCalledWith(false);
    });

    it('applies manual mute directly when no track is soloed', () => {
      const playout = new TonePlayout();
      const trackA = playout.addTrack({ clips: [], track: makeTrack('a') });

      playout.setMute('a', true);
      expect(trackA.setMute).toHaveBeenCalledWith(true);

      playout.setMute('a', false);
      expect(trackA.setMute).toHaveBeenCalledWith(false);
    });
  });
});
