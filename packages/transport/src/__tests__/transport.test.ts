import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { Transport } from '../transport';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { Tick, Sample, SchedulerListenerError } from '../types';

function createMockSource() {
  return {
    buffer: null as AudioBuffer | null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

function createMockGainNode() {
  return {
    gain: {
      value: 1,
      linearRampToValueAtTime: vi.fn(),
      setValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function createMockPannerNode() {
  return {
    pan: { value: 0 },
    channelCount: 1,
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

let rafCallbacks: Array<(time: number) => void>;
let rafId: number;

function mockAudioContext(currentTime = 0): AudioContext {
  return {
    sampleRate: 48000,
    currentTime,
    state: 'running',
    destination: { connect: vi.fn(), disconnect: vi.fn() },
    createGain: vi.fn(() => createMockGainNode()),
    createStereoPanner: vi.fn(() => createMockPannerNode()),
    createBufferSource: vi.fn(() => createMockSource()),
    resume: vi.fn(() => Promise.resolve()),
  } as unknown as AudioContext;
}

function makeClip(overrides: Partial<AudioClip> = {}): AudioClip {
  return {
    id: 'clip-1',
    startSample: 0,
    durationSamples: 48000,
    offsetSamples: 0,
    sampleRate: 48000,
    sourceDurationSamples: 96000,
    gain: 1,
    audioBuffer: {
      duration: 2,
      length: 96000,
      sampleRate: 48000,
      numberOfChannels: 2,
      getChannelData: vi.fn(),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    } as unknown as AudioBuffer,
    ...overrides,
  };
}

function makeTrack(clips: AudioClip[], overrides: Partial<ClipTrack> = {}): ClipTrack {
  return {
    id: 'track-1',
    name: 'Track 1',
    clips,
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
    ...overrides,
  };
}

describe('Transport', () => {
  beforeEach(() => {
    rafCallbacks = [];
    rafId = 0;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: (time: number) => void) => {
        rafCallbacks.push(cb);
        return ++rafId;
      })
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts in stopped state', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    expect(transport.isPlaying()).toBe(false);
    expect(transport.getCurrentTime()).toBe(0);
  });

  it('play starts the transport', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.play();
    expect(transport.isPlaying()).toBe(true);
  });

  it('pause preserves position', () => {
    const ctx = mockAudioContext(10);
    const transport = new Transport(ctx);
    transport.play();
    (ctx as any).currentTime = 12;
    transport.pause();
    expect(transport.isPlaying()).toBe(false);
    expect(transport.getCurrentTime()).toBeCloseTo(2);
  });

  it('play after pause re-schedules mid-clip sources', () => {
    const ctx = mockAudioContext(10);
    const transport = new Transport(ctx);
    const clip = makeClip({
      startSample: 0,
      durationSamples: 96000, // 2s clip
    });
    const track = makeTrack([clip]);
    transport.setTracks([track]);

    transport.play();
    (ctx as any).currentTime = 11; // 1s into playback
    transport.pause();
    // After pause, all sources are silenced

    (ctx as any).currentTime = 12;
    transport.play(); // resume

    // Should have created a mid-clip source via onPositionJump
    // (clip started at 0, current time is 1s, so mid-clip at offset 1s)
    const sourceCount = (ctx.createBufferSource as any).mock.results.length;
    expect(sourceCount).toBeGreaterThanOrEqual(1);
  });

  it('stop resets position to 0', () => {
    const ctx = mockAudioContext(10);
    const transport = new Transport(ctx);
    transport.play();
    (ctx as any).currentTime = 12;
    transport.stop();
    expect(transport.isPlaying()).toBe(false);
    expect(transport.getCurrentTime()).toBe(0);
  });

  it('seek during playback updates position', () => {
    const ctx = mockAudioContext(10);
    const transport = new Transport(ctx);
    transport.play();
    transport.seek(5);
    (ctx as any).currentTime = 12;
    expect(transport.getCurrentTime()).toBeCloseTo(7); // 5 + 2
  });

  it('seek while stopped sets position', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.seek(3);
    expect(transport.getCurrentTime()).toBe(3);
  });

  it('setTracks creates track nodes', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    const track = makeTrack([makeClip()]);
    transport.setTracks([track]);
    // Should create gain + panner + gain (mute) per track + 1 master gain
    // 2 gains per track + 1 master = 3
    expect((ctx.createGain as any).mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('setTrackVolume updates volume', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    const track = makeTrack([makeClip()]);
    transport.setTracks([track]);
    // Should not throw
    transport.setTrackVolume('track-1', 0.5);
  });

  it('setTrackMute mutes track', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    const track = makeTrack([makeClip()]);
    transport.setTracks([track]);
    transport.setTrackMute('track-1', true);
  });

  it('solo logic mutes non-soloed tracks', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    const track1 = makeTrack([makeClip()], { id: 'track-1' });
    const track2 = makeTrack([makeClip({ id: 'clip-2' })], {
      id: 'track-2',
      name: 'Track 2',
    });
    transport.setTracks([track1, track2]);
    transport.setTrackSolo('track-1', true);
    // track-2 should be effectively muted (solo active, track-2 not soloed)
  });

  it('setLoopSeconds configures loop region', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setLoopSeconds(true, 1, 3);
    // Should not throw
  });

  it('setMasterVolume updates master gain', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setMasterVolume(0.5);
  });

  it('events: on/off for play/pause/stop', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    const onPlay = vi.fn();
    const onPause = vi.fn();
    const onStop = vi.fn();

    transport.on('play', onPlay);
    transport.on('pause', onPause);
    transport.on('stop', onStop);

    transport.play();
    expect(onPlay).toHaveBeenCalledTimes(1);

    transport.pause();
    expect(onPause).toHaveBeenCalledTimes(1);

    transport.play();
    transport.stop();
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('off removes listener', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    const onPlay = vi.fn();
    transport.on('play', onPlay);
    transport.off('play', onPlay);
    transport.play();
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('seek emits a seek event with the target position', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    const onSeek = vi.fn();
    transport.on('seek', onSeek);

    transport.seek(3.5);

    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledWith({ seconds: 3.5 });
  });

  it('dispose cleans up', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    const track = makeTrack([makeClip()]);
    transport.setTracks([track]);
    transport.dispose();
    expect(transport.isPlaying()).toBe(false);
  });

  it('setTempo updates tempo', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setTempo(140);
    expect(transport.getTempo()).toBe(140);
  });

  it('setTempo with atTick schedules tempo change', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setTempo(140, 3840 as Tick); // 140 BPM at bar 2
    expect(transport.getTempo(0 as Tick)).toBe(120); // default
    expect(transport.getTempo(3840 as Tick)).toBe(140);
  });

  describe('setTempo multi-entry guard (#407)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('refuses a defaulted setTempo when the tempo map has multiple entries', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const ctx = mockAudioContext();
      const transport = new Transport(ctx);
      transport.setTempo(100, 0 as Tick);
      transport.setTempo(140, 960 as Tick);
      warnSpy.mockClear(); // isolate the assertion from any warns emitted during setup

      const applied = transport.setTempo(120); // defaulted atTick — "display BPM" style call

      expect(applied).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Pass an explicit atTick'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('120'));
      expect(transport.getTempo(0 as Tick)).toBe(100);
    });

    it('accepts a defaulted setTempo again after clearTempos returns the map to one entry', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const ctx = mockAudioContext();
      const transport = new Transport(ctx);
      transport.setTempo(140, 960 as Tick); // multi-entry: guard active
      transport.clearTempos();
      warnSpy.mockClear(); // isolate the assertion from any warns emitted during setup

      const applied = transport.setTempo(100);

      expect(applied).toBe(true);
      expect(warnSpy).not.toHaveBeenCalled();
      expect(transport.getTempo()).toBe(100);
    });

    it('does not emit tempochange when the guard refuses', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const ctx = mockAudioContext();
      const transport = new Transport(ctx);
      transport.setTempo(140, 960 as Tick);
      const listener = vi.fn();
      transport.on('tempochange', listener);

      transport.setTempo(120);

      expect(listener).not.toHaveBeenCalled();
    });

    it('applies an explicit atTick 0 write on a multi-entry map', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const ctx = mockAudioContext();
      const transport = new Transport(ctx);
      transport.setTempo(100, 0 as Tick);
      transport.setTempo(140, 960 as Tick);
      warnSpy.mockClear(); // isolate the assertion from any warns emitted during setup

      const applied = transport.setTempo(120, 0 as Tick); // explicit — escape hatch

      expect(applied).toBe(true);
      expect(warnSpy).not.toHaveBeenCalled();
      expect(transport.getTempo(0 as Tick)).toBe(120);
    });

    it('applies a defaulted setTempo on a single-entry map', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const ctx = mockAudioContext();
      const transport = new Transport(ctx);
      warnSpy.mockClear(); // isolate the assertion from any warns emitted during setup

      const applied = transport.setTempo(120);

      expect(applied).toBe(true);
      expect(warnSpy).not.toHaveBeenCalled();
      expect(transport.getTempo()).toBe(120);
    });
  });

  it('setMeter changes time signature', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setMeter(7, 8);
    const meter = transport.getMeter();
    expect(meter.numerator).toBe(7);
    expect(meter.denominator).toBe(8);
  });

  it('setMeter at tick fires meterchange event', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    const onMeter = vi.fn();
    transport.on('meterchange', onMeter);
    transport.setMeter(3, 4, 3840 as Tick);
    expect(onMeter).toHaveBeenCalledTimes(1);
  });

  it('barToTick delegates to MeterMap', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    expect(transport.barToTick(1)).toBe(0);
    expect(transport.barToTick(2)).toBe(3840); // 4/4 default
  });

  it('removeMeter fires meterchange event', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setMeter(7, 8, 3840 as Tick);
    const onMeter = vi.fn();
    transport.on('meterchange', onMeter);
    transport.removeMeter(3840 as Tick);
    expect(onMeter).toHaveBeenCalledTimes(1);
  });

  it('constructor accepts numerator/denominator options', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx, { numerator: 6, denominator: 8 });
    expect(transport.getMeter().numerator).toBe(6);
    expect(transport.getMeter().denominator).toBe(8);
  });

  it('clearMeters fires meterchange and resets state', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setMeter(7, 8, 3840 as Tick);
    const onMeter = vi.fn();
    transport.on('meterchange', onMeter);
    transport.clearMeters();
    expect(onMeter).toHaveBeenCalledTimes(1);
    expect(transport.getMeter().numerator).toBe(4);
  });

  it('clearTempos fires tempochange', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setTempo(140, 3840 as Tick);
    const onTempo = vi.fn();
    transport.on('tempochange', onTempo);
    transport.clearTempos();
    expect(onTempo).toHaveBeenCalledTimes(1);
    expect(transport.getTempo()).toBe(120);
  });

  it('tickToBar delegates to MeterMap', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    expect(transport.tickToBar(0 as Tick)).toBe(1);
    expect(transport.tickToBar(3840 as Tick)).toBe(2);
  });

  it('timeToTickExact returns fractional ticks while timeToTick rounds (#636)', () => {
    const transport = new Transport(mockAudioContext()); // 120 BPM × 960 PPQN = 1920 ticks/s
    expect(transport.timeToTickExact(0.0005)).toBeCloseTo(0.96, 10);
    expect(transport.timeToTick(0.0005)).toBe(1);
  });

  it('tickToTime accepts the fractional position timeToTickExact returns', () => {
    const transport = new Transport(mockAudioContext());
    const exact = transport.timeToTickExact(0.0005); // 0.96 ticks
    expect(transport.tickToTime(exact)).toBeCloseTo(0.0005, 12);
  });

  it('quantizeTick snaps on the transport meter map (#636)', () => {
    const transport = new Transport(mockAudioContext());
    transport.setMeter(7, 8); // bar = 3360 ticks at 960 PPQN
    expect(transport.quantizeTick(3200, { ticks: 960 }, { mode: 'next' })).toBe(3360);
    expect(transport.quantizeTick(400, { note: 8 })).toBe(480);
    expect(transport.quantizeTick(400, { ticks: 480 }, { strength: 0.5 })).toBe(440);
    // The LIVE meter map, not a snapshot: a later meter change is seen.
    transport.setMeter(3, 4, 3360 as Tick);
    expect(transport.quantizeTick(3400, 'bar', { mode: 'next' })).toBe(3360 + 2880);
  });

  it('timeToTick and tickToTime round-trip', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    const tick = 3840 as Tick;
    const time = transport.tickToTime(tick);
    expect(transport.timeToTick(time)).toBe(tick);
  });

  it('addTrack adds a single track', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setTracks([]);
    const track = makeTrack([makeClip()]);
    transport.addTrack(track);
    // Should not throw
  });

  it('removeTrack removes a track', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    const track = makeTrack([makeClip()]);
    transport.setTracks([track]);
    transport.removeTrack('track-1');
  });

  it('tempochange event includes bpm and atTick payload', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    const onTempo = vi.fn();
    transport.on('tempochange', onTempo);
    transport.setTempo(140, 3840 as Tick);
    expect(onTempo).toHaveBeenCalledWith({ bpm: 140, atTick: 3840 });
  });

  it('tempochange at tick 0 uses default tick', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    const onTempo = vi.fn();
    transport.on('tempochange', onTempo);
    transport.setTempo(140);
    expect(onTempo).toHaveBeenCalledWith({ bpm: 140, atTick: 0 });
  });

  it('meterchange event includes numerator, denominator, and atTick payload', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    const onMeter = vi.fn();
    transport.on('meterchange', onMeter);
    transport.setMeter(3, 4, 3840 as Tick);
    expect(onMeter).toHaveBeenCalledWith({
      numerator: 3,
      denominator: 4,
      atTick: 3840,
    });
  });

  it('meterchange at tick 0 uses default tick', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    const onMeter = vi.fn();
    transport.on('meterchange', onMeter);
    transport.setMeter(6, 8);
    expect(onMeter).toHaveBeenCalledWith({
      numerator: 6,
      denominator: 8,
      atTick: 0,
    });
  });

  it('clearTempos emits tempochange with default BPM', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setTempo(140, 3840 as Tick);
    const onTempo = vi.fn();
    transport.on('tempochange', onTempo);
    transport.clearTempos();
    expect(onTempo).toHaveBeenCalledWith({ bpm: 120, atTick: 0 });
  });

  it('clearMeters emits meterchange with default meter', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setMeter(7, 8, 3840 as Tick);
    const onMeter = vi.fn();
    transport.on('meterchange', onMeter);
    transport.clearMeters();
    expect(onMeter).toHaveBeenCalledWith({
      numerator: 4,
      denominator: 4,
      atTick: 0,
    });
  });

  it('removeMeter emits meterchange with meter at removed tick', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setMeter(7, 8, 3840 as Tick);
    const onMeter = vi.fn();
    transport.on('meterchange', onMeter);
    transport.removeMeter(3840 as Tick);
    // After removal, meter at 3840 falls back to default 4/4
    expect(onMeter).toHaveBeenCalledWith({
      numerator: 4,
      denominator: 4,
      atTick: 3840,
    });
  });

  it('existing () => void listeners still work after payload addition', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    const noArgListener = vi.fn();
    transport.on('tempochange', noArgListener as any);
    transport.setTempo(140);
    // Should not throw — extra args are ignored
    expect(noArgListener).toHaveBeenCalledTimes(1);
  });

  describe('master effects hook (#416)', () => {
    function getMasterGain(ctx: AudioContext) {
      // MasterNode creates the first GainNode during Transport construction.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (ctx.createGain as any).mock.results[0].value;
    }

    function createMockChainInput() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { connect: vi.fn(), disconnect: vi.fn() } as any;
    }

    it('connectMasterOutput inserts the chain between master gain and destination', () => {
      const ctx = mockAudioContext();
      const transport = new Transport(ctx);
      const chainInput = createMockChainInput();

      transport.connectMasterOutput(chainInput);

      const masterGain = getMasterGain(ctx);
      expect(masterGain.disconnect).toHaveBeenCalledWith(ctx.destination);
      expect(masterGain.connect).toHaveBeenCalledWith(chainInput);
    });

    it('disconnectMasterOutput restores direct routing to destination', () => {
      const ctx = mockAudioContext();
      const transport = new Transport(ctx);
      const chainInput = createMockChainInput();

      transport.connectMasterOutput(chainInput);
      transport.disconnectMasterOutput();

      const masterGain = getMasterGain(ctx);
      expect(masterGain.disconnect).toHaveBeenCalledWith(chainInput);
      const lastConnect = masterGain.connect.mock.calls.at(-1)[0];
      expect(lastConnect).toBe(ctx.destination);
    });

    it('connectMasterOutput twice replaces the chain without double-connections', () => {
      const ctx = mockAudioContext();
      const transport = new Transport(ctx);
      const firstChain = createMockChainInput();
      const secondChain = createMockChainInput();

      transport.connectMasterOutput(firstChain);
      transport.connectMasterOutput(secondChain);

      const masterGain = getMasterGain(ctx);
      expect(masterGain.disconnect).toHaveBeenCalledWith(firstChain);
      expect(masterGain.connect.mock.calls.map((c: unknown[]) => c[0])).toEqual([
        ctx.destination,
        firstChain,
        secondChain,
      ]);
    });

    it('dispose while master chain connected does not throw', () => {
      const ctx = mockAudioContext();
      const transport = new Transport(ctx);
      transport.connectMasterOutput(createMockChainInput());

      expect(() => transport.dispose()).not.toThrow();
    });
  });

  describe('error surfacing (#636)', () => {
    it('setLoop throws on start >= end and leaves loop state untouched', () => {
      const transport = new Transport(mockAudioContext());
      const onLoop = vi.fn();
      transport.on('loop', onLoop);
      expect(() => transport.setLoop(true, 960 as Tick, 480 as Tick)).toThrow(/must be less than/);
      expect(() => transport.setLoop(true, 960 as Tick, 960 as Tick)).toThrow(/must be less than/);
      expect(onLoop).not.toHaveBeenCalled();
    });

    it('setLoop throws on non-finite ticks before touching any state', () => {
      const transport = new Transport(mockAudioContext());
      const onLoop = vi.fn();
      transport.on('loop', onLoop);
      expect(() => transport.setLoop(true, NaN as Tick, 960 as Tick)).toThrow(/non-finite/);
      expect(() => transport.setLoop(true, 0 as Tick, Infinity as Tick)).toThrow(/non-finite/);
      expect(onLoop).not.toHaveBeenCalled();
    });

    it('setLoopSeconds and setLoopSamples reject invalid ranges the same way', () => {
      const transport = new Transport(mockAudioContext());
      expect(() => transport.setLoopSeconds(true, 3, 1)).toThrow(/must be less than/);
      expect(() => transport.setLoopSeconds(true, NaN, 1)).toThrow(/non-finite/);
      expect(() => transport.setLoopSamples(true, 96000 as Sample, 48000 as Sample)).toThrow(
        /must be less than/
      );
      expect(() => transport.setLoopSamples(true, NaN as Sample, 48000 as Sample)).toThrow(
        /non-finite/
      );
    });

    it('a sample range shorter than one tick throws before touching any state', () => {
      // 48 kHz at 120 BPM / 960 PPQN: one tick is 25 samples. 100 and 110 both
      // round to tick 4, so the sample-unit check passes but the loop is empty.
      const transport = new Transport(mockAudioContext());
      const onLoop = vi.fn();
      transport.on('loop', onLoop);
      expect(() => transport.setLoopSamples(true, 100 as Sample, 110 as Sample)).toThrow(
        /shorter than one tick/
      );
      expect(onLoop).not.toHaveBeenCalled();
      // The clip player must not have been given the half-applied loop either:
      // a following valid loop works and is the first 'loop' event seen.
      transport.setLoopSamples(true, 0 as Sample, 48000 as Sample);
      expect(onLoop).toHaveBeenCalledTimes(1);
    });

    it('a seconds range shorter than one tick throws naming the caller unit', () => {
      const transport = new Transport(mockAudioContext());
      expect(() => transport.setLoopSeconds(true, 1, 1.0001)).toThrow(
        /setLoopSeconds: range \(1, 1\.0001 second\) is shorter than one tick/
      );
    });

    it('setLoop rejects fractional ticks rather than rounding into an empty loop', () => {
      const transport = new Transport(mockAudioContext());
      expect(() => transport.setLoop(true, 960.6 as Tick, 961.4 as Tick)).toThrow(/integer/);
    });

    it('disabling the loop never throws, whatever the range', () => {
      const transport = new Transport(mockAudioContext());
      expect(() => transport.setLoop(false, 960 as Tick, 480 as Tick)).not.toThrow();
      expect(() => transport.setLoopSeconds(false, 0, 0)).not.toThrow();
    });

    it('a listener failure during scheduling is emitted as an error event, not warned', async () => {
      const ctx = mockAudioContext();
      const failure = new Error('createBufferSource exploded');
      const transport = new Transport(ctx);
      transport.setTracks([makeTrack([makeClip()])]);
      const onError = vi.fn();
      transport.on('error', onError);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (ctx.createBufferSource as Mock).mockImplementation(() => {
        throw failure;
      });

      transport.play();
      for (const cb of [...rafCallbacks]) cb(16);
      // Delivered on a microtask, after the scheduler window completes, so a
      // handler that calls stop()/setTracks() cannot re-enter the iteration.
      expect(onError).not.toHaveBeenCalled();
      await Promise.resolve();
      transport.stop();

      expect(onError).toHaveBeenCalledTimes(1);
      const event = onError.mock.calls[0][0] as SchedulerListenerError;
      expect(event.phase).toBe('consume');
      expect(event.error).toBe(failure);
      expect(event.phase === 'consume' && event.event.tick).toBe(0);
      expect(typeof event.listener.consume).toBe('function');
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('an error handler that stops the transport does not let the rest of the window play', async () => {
      const ctx = mockAudioContext();
      const transport = new Transport(ctx);
      // Two clips at tick 0 on two tracks: the first source creation throws,
      // the handler stops the transport, and the second clip must NOT be
      // scheduled afterwards.
      transport.setTracks([
        makeTrack([makeClip({ id: 'a' })], { id: 't1' }),
        makeTrack([makeClip({ id: 'b' })], { id: 't2' }),
      ]);
      transport.on('error', () => transport.stop());
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const create = ctx.createBufferSource as Mock;
      create.mockImplementationOnce(() => {
        throw new Error('first source exploded');
      });

      transport.play();
      for (const cb of [...rafCallbacks]) cb(16);
      await Promise.resolve();

      expect(transport.isPlaying()).toBe(false);
      // One failed attempt, one successful source for clip b — created BEFORE
      // the handler ran (same window) and silenced by stop(); no source may be
      // created after the stop.
      const createdAfterStop = create.mock.results.length;
      for (const cb of [...rafCallbacks]) cb(32);
      expect(create.mock.results.length).toBe(createdAfterStop);
      warn.mockRestore();
    });

    it('a failure whose subscriber is gone by delivery time still reaches console.warn', async () => {
      const ctx = mockAudioContext();
      const transport = new Transport(ctx);
      transport.setTracks([makeTrack([makeClip()])]);
      const onError = vi.fn();
      transport.on('error', onError);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (ctx.createBufferSource as Mock).mockImplementation(() => {
        throw new Error('createBufferSource exploded');
      });
      transport.play();
      for (const cb of [...rafCallbacks]) cb(16);
      transport.dispose(); // clears every listener before the microtask runs
      await Promise.resolve();
      expect(onError).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('createBufferSource exploded'));
      warn.mockRestore();
    });

    function fakeClick(): AudioBuffer {
      return {
        duration: 0.04,
        length: 1920,
        sampleRate: 48000,
        numberOfChannels: 1,
      } as AudioBuffer;
    }

    it('without a subscriber a persistently failing metronome warns once, not once per beat', async () => {
      const ctx = mockAudioContext(0);
      const transport = new Transport(ctx);
      transport.setMetronomeClickSounds(fakeClick(), fakeClick());
      transport.setMetronomeEnabled(true);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (ctx.createBufferSource as Mock).mockImplementation(() => {
        throw new Error('no clicks today');
      });
      transport.play();
      for (const t of [0, 0.5, 1.0]) {
        (ctx as any).currentTime = t;
        for (const cb of [...rafCallbacks]) cb(16);
      }
      transport.stop();
      await Promise.resolve(); // console fallback is decided at delivery time
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('no clicks today');
      warn.mockRestore();
    });

    it('with a subscriber every failing beat is delivered — dedupe only applies to the console', async () => {
      const ctx = mockAudioContext(0);
      const transport = new Transport(ctx);
      transport.setMetronomeClickSounds(fakeClick(), fakeClick());
      transport.setMetronomeEnabled(true);
      const onError = vi.fn();
      transport.on('error', onError);
      (ctx.createBufferSource as Mock).mockImplementation(() => {
        throw new Error('no clicks today');
      });
      transport.play();
      for (const t of [0, 0.5, 1.0]) {
        (ctx as any).currentTime = t;
        for (const cb of [...rafCallbacks]) cb(16);
      }
      await Promise.resolve();
      transport.stop();
      expect(onError).toHaveBeenCalledTimes(3);
    });

    it('without an error listener a scheduling failure still reaches console.warn', async () => {
      const ctx = mockAudioContext();
      const transport = new Transport(ctx);
      transport.setTracks([makeTrack([makeClip()])]);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (ctx.createBufferSource as Mock).mockImplementation(() => {
        throw new Error('createBufferSource exploded');
      });

      transport.play();
      for (const cb of [...rafCallbacks]) cb(16);
      transport.stop();
      await Promise.resolve();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('createBufferSource exploded'));
      warn.mockRestore();
    });
  });
});
