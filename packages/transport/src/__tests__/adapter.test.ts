import { describe, it, expect, vi, afterEach } from 'vitest';
import { NativePlayoutAdapter } from '../adapter';
import { DEFAULT_TIMER_INTERVAL_MS } from '../core/timer';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

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

function mockAudioContext(): AudioContext {
  const ctx = {
    sampleRate: 48000,
    currentTime: 0,
    state: 'suspended',
    destination: { connect: vi.fn(), disconnect: vi.fn() },
    createGain: vi.fn(() => createMockGainNode()),
    createStereoPanner: vi.fn(() => createMockPannerNode()),
    createBufferSource: vi.fn(() => createMockSource()),
    resume: vi.fn(() => {
      // Simulate AudioContext advancing after resume (needed for warmup wait)
      ctx.currentTime = 1.0;
      ctx.state = 'running';
      return Promise.resolve();
    }),
  };
  return ctx as unknown as AudioContext;
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

describe('NativePlayoutAdapter', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('implements PlayoutAdapter interface', () => {
    const ctx = mockAudioContext();
    const adapter: PlayoutAdapter = new NativePlayoutAdapter(ctx);
    expect(adapter.init).toBeDefined();
    expect(adapter.setTracks).toBeDefined();
    expect(adapter.play).toBeDefined();
    expect(adapter.pause).toBeDefined();
    expect(adapter.stop).toBeDefined();
    expect(adapter.seek).toBeDefined();
    expect(adapter.getCurrentTime).toBeDefined();
    expect(adapter.isPlaying).toBeDefined();
    expect(adapter.setMasterVolume).toBeDefined();
    expect(adapter.setTrackVolume).toBeDefined();
    expect(adapter.setTrackMute).toBeDefined();
    expect(adapter.setTrackSolo).toBeDefined();
    expect(adapter.setTrackPan).toBeDefined();
    expect(adapter.setLoop).toBeDefined();
    expect(adapter.dispose).toBeDefined();
  });

  it('has optional methods: addTrack, removeTrack, updateTrack', () => {
    const ctx = mockAudioContext();
    const adapter = new NativePlayoutAdapter(ctx);
    expect(adapter.addTrack).toBeDefined();
    expect(adapter.removeTrack).toBeDefined();
    expect(adapter.updateTrack).toBeDefined();
  });

  it('init resumes suspended AudioContext', async () => {
    const ctx = mockAudioContext();
    const adapter = new NativePlayoutAdapter(ctx);
    await adapter.init();
    expect(ctx.resume).toHaveBeenCalled();
  });

  it('init warmup loop polls (setTimeout, not rAF) until currentTime advances', async () => {
    vi.useFakeTimers();
    const ctx = mockAudioContext();
    // Override: resume does NOT advance currentTime (simulates Safari warmup)
    (ctx as any).resume = vi.fn(() => {
      (ctx as any).state = 'running';
      // currentTime stays at 0 — warmup loop must poll
      return Promise.resolve();
    });

    const adapter = new NativePlayoutAdapter(ctx);
    let resolved = false;
    const initPromise = adapter.init().then(() => {
      resolved = true;
    });

    // Wait for resume() microtask to settle
    await Promise.resolve();
    await Promise.resolve();

    // Warmup should be polling on a timer — not yet resolved
    expect(resolved).toBe(false);
    expect(vi.getTimerCount()).toBe(1);

    // A poll that finds currentTime still at 0 schedules another
    await vi.advanceTimersByTimeAsync(16);
    expect(resolved).toBe(false);

    // Advance currentTime past warmup target and let the next poll run
    (ctx as any).currentTime = 0.05;
    await vi.advanceTimersByTimeAsync(16);

    await initPromise;
    expect(resolved).toBe(true);
  });

  it('init warmup times out after max wait', async () => {
    const ctx = mockAudioContext();
    (ctx as any).resume = vi.fn(() => {
      (ctx as any).state = 'running';
      return Promise.resolve();
    });

    // Mock performance.now to jump past timeout
    vi.useFakeTimers();
    const originalNow = performance.now;
    let mockNow = 0;
    vi.stubGlobal('performance', { now: () => mockNow });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const adapter = new NativePlayoutAdapter(ctx);
    const initPromise = adapter.init();

    await Promise.resolve();
    await Promise.resolve();

    // Jump past 2s timeout and let the next poll run
    mockNow = 3000;
    await vi.advanceTimersByTimeAsync(16);

    await initPromise;
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('warmup timed out'));

    warnSpy.mockRestore();
    vi.stubGlobal('performance', { now: originalNow });
  });

  it('init rejects when the context closes during the warmup poll', async () => {
    vi.useFakeTimers();
    const ctx = mockAudioContext();
    (ctx as any).resume = vi.fn(() => {
      (ctx as any).state = 'running';
      return Promise.resolve();
    });
    const adapter = new NativePlayoutAdapter(ctx);
    // Attach the rejection handler BEFORE the poll rejects, or vitest reports
    // an unhandled rejection for the window between the two.
    const rejection = expect(adapter.init()).rejects.toThrow(/closed/);
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(16);
    (ctx as any).state = 'closed';
    await vi.advanceTimersByTimeAsync(16);
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('init skips resume for running AudioContext', async () => {
    const ctx = mockAudioContext();
    (ctx as any).state = 'running';
    const adapter = new NativePlayoutAdapter(ctx);
    await adapter.init();
    expect(ctx.resume).not.toHaveBeenCalled();
  });

  it('transport getter exposes Transport instance', () => {
    const ctx = mockAudioContext();
    const adapter = new NativePlayoutAdapter(ctx);
    expect(adapter.transport).toBeDefined();
    expect(adapter.transport.isPlaying()).toBe(false);
  });

  it('delegates play/pause/stop', () => {
    const ctx = mockAudioContext();
    (ctx as any).state = 'running';
    const adapter = new NativePlayoutAdapter(ctx);
    const track = makeTrack([makeClip()]);
    adapter.setTracks([track]);

    adapter.play(0);
    expect(adapter.isPlaying()).toBe(true);

    adapter.pause();
    expect(adapter.isPlaying()).toBe(false);

    adapter.play(0);
    adapter.stop();
    expect(adapter.isPlaying()).toBe(false);
    expect(adapter.getCurrentTime()).toBe(0);
  });

  it('delegates seek', () => {
    const ctx = mockAudioContext();
    const adapter = new NativePlayoutAdapter(ctx);
    adapter.seek(5);
    expect(adapter.getCurrentTime()).toBe(5);
  });

  it('delegates track operations', () => {
    const ctx = mockAudioContext();
    const adapter = new NativePlayoutAdapter(ctx);
    const track = makeTrack([makeClip()]);

    adapter.setTracks([track]);
    adapter.setTrackVolume('track-1', 0.5);
    adapter.setTrackPan('track-1', -0.3);
    adapter.setTrackMute('track-1', true);
    adapter.setTrackSolo('track-1', true);
    // Should not throw
  });

  it('delegates master volume', () => {
    const ctx = mockAudioContext();
    const adapter = new NativePlayoutAdapter(ctx);
    adapter.setMasterVolume(0.7);
    // Should not throw
  });

  it('delegates loop', () => {
    const ctx = mockAudioContext();
    const adapter = new NativePlayoutAdapter(ctx);
    const spy = vi.spyOn(adapter.transport, 'setLoopSeconds');
    adapter.setLoop(true, 1, 5);
    expect(spy).toHaveBeenCalledWith(true, 1, 5);
  });

  it('setLoop with the engine default zero-length region disables the loop instead of throwing', () => {
    // PlaylistEngine starts with loopStart = loopEnd = 0 and forwards
    // setLoopEnabled(true) before any region is chosen. Transport.setLoop
    // rejects a degenerate enabled range, so the adapter must translate it.
    const ctx = mockAudioContext();
    const adapter = new NativePlayoutAdapter(ctx);
    const spy = vi.spyOn(adapter.transport, 'setLoopSeconds');
    expect(() => adapter.setLoop(true, 0, 0)).not.toThrow();
    expect(spy).toHaveBeenCalledWith(false, 0, 0);
  });

  it('setLoop with an inverted region disables the loop with a warning instead of throwing', () => {
    const ctx = mockAudioContext();
    const adapter = new NativePlayoutAdapter(ctx);
    const spy = vi.spyOn(adapter.transport, 'setLoopSeconds');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => adapter.setLoop(true, 5, 1)).not.toThrow();
    expect(spy).toHaveBeenCalledWith(false, 5, 1);
    // An inverted range is a caller bug worth a diagnostic; the empty default
    // region (start === end) is not.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('inverted'));
    warn.mockClear();
    adapter.setLoop(true, 0, 0);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('setLoop with a region shorter than one tick disables the loop instead of throwing', () => {
    // 0.5 s → 0.5002 s is 0.38 ticks at 120 BPM / 960 PPQN: non-empty in
    // seconds, empty in ticks. A 1-px loop selection at high zoom does this.
    const ctx = mockAudioContext();
    const adapter = new NativePlayoutAdapter(ctx);
    const spy = vi.spyOn(adapter.transport, 'setLoopSeconds');
    expect(() => adapter.setLoop(true, 0.5, 0.5002)).not.toThrow();
    expect(spy).toHaveBeenCalledWith(false, 0.5, 0.5002);
  });

  it('setLoop decides sub-tick degeneracy with the live tempo', () => {
    // 0.5 → 0.5004 s: 0.38 ticks at 60 BPM (both round to 480 → empty) but
    // 0.77 ticks at 120 BPM (960 → 961 → a real loop).
    const ctx = mockAudioContext();
    const adapter = new NativePlayoutAdapter(ctx);
    const spy = vi.spyOn(adapter.transport, 'setLoopSeconds');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    adapter.setTempo(60);
    adapter.setLoop(true, 0.5, 0.5004);
    expect(spy).toHaveBeenLastCalledWith(false, 0.5, 0.5004);
    adapter.setTempo(120);
    adapter.setLoop(true, 0.5, 0.5004);
    expect(spy).toHaveBeenLastCalledWith(true, 0.5, 0.5004);
    warn.mockRestore();
  });

  it('setLoop warns for a user-made empty region but not for the engine default', () => {
    const ctx = mockAudioContext();
    const adapter = new NativePlayoutAdapter(ctx);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    adapter.setLoop(true, 0, 0);
    expect(warn).not.toHaveBeenCalled();
    adapter.setLoop(true, 3, 3); // a click without a drag, then loop toggled on
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('empty'));
    warn.mockClear();
    adapter.setLoop(true, 0.5, 0.5002); // sub-tick selection
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('shorter than one tick'));
    warn.mockRestore();
  });

  it('delegates dispose', () => {
    const ctx = mockAudioContext();
    const adapter = new NativePlayoutAdapter(ctx);
    adapter.dispose();
    expect(adapter.isPlaying()).toBe(false);
  });

  // --- Tempo and conversion methods ---

  it('setTempo delegates to transport', () => {
    const ctx = mockAudioContext();
    const adapter = new NativePlayoutAdapter(ctx);
    const spy = vi.spyOn(adapter.transport, 'setTempo');
    adapter.setTempo(140);
    expect(spy).toHaveBeenCalledWith(140, undefined);
  });

  it('setTempo with atTick delegates to transport', () => {
    const ctx = mockAudioContext();
    const adapter = new NativePlayoutAdapter(ctx);
    const spy = vi.spyOn(adapter.transport, 'setTempo');
    adapter.setTempo(140, 960);
    expect(spy).toHaveBeenCalledWith(140, 960);
  });

  it('ticksToSeconds delegates to transport', () => {
    const ctx = mockAudioContext();
    const adapter = new NativePlayoutAdapter(ctx);
    // Default: 120 BPM, 960 PPQN. 960 ticks = 0.5 seconds
    expect(adapter.ticksToSeconds(960)).toBeCloseTo(0.5);
  });

  it('secondsToTicks delegates to transport', () => {
    const ctx = mockAudioContext();
    const adapter = new NativePlayoutAdapter(ctx);
    expect(adapter.secondsToTicks(0.5)).toBe(960);
  });

  it('secondsToTicksExact exposes the fractional position through the adapter', () => {
    const ctx = mockAudioContext();
    const adapter = new NativePlayoutAdapter(ctx);
    expect(adapter.secondsToTicksExact(0.0005)).toBeCloseTo(0.96, 10);
    expect(adapter.secondsToTicks(0.0005)).toBe(1);
  });

  it('setMeter delegates to transport', () => {
    const ctx = mockAudioContext();
    const adapter = new NativePlayoutAdapter(ctx);
    const spy = vi.spyOn(adapter.transport, 'setMeter');
    adapter.setMeter(3, 4);
    expect(spy).toHaveBeenCalledWith(3, 4, undefined);
  });

  describe('onPlaybackEnded — bounded playback completion (#608 parity)', () => {
    // Without this hook the editor's rAF loop was the sole stopper of a
    // bounded play(start, end) on the native path, and it only won the race
    // against the transport's own endTime self-stop because both ran on rAF
    // in registration order. The Worker timer (#636) removes that ordering.
    function playingAdapter() {
      vi.useFakeTimers();
      const ctx = mockAudioContext();
      const adapter = new NativePlayoutAdapter(ctx);
      const ended = vi.fn();
      adapter.onPlaybackEnded(ended);
      return { ctx, adapter, ended };
    }

    it('fires once when the transport stops itself at endTime', () => {
      const { ctx, adapter, ended } = playingAdapter();
      adapter.play(0, 1);
      (ctx as any).currentTime = 1.5;
      vi.advanceTimersByTime(DEFAULT_TIMER_INTERVAL_MS);
      expect(ended).toHaveBeenCalledTimes(1);
      expect(adapter.isPlaying()).toBe(false);
      vi.advanceTimersByTime(DEFAULT_TIMER_INTERVAL_MS * 4);
      expect(ended).toHaveBeenCalledTimes(1);
    });

    it('does not fire for a consumer stop() or pause()', () => {
      const { adapter, ended } = playingAdapter();
      adapter.play(0, 10);
      adapter.stop();
      adapter.play(0, 10);
      adapter.pause();
      expect(ended).not.toHaveBeenCalled();
    });

    it('does not fire for a stop caused by seek while playing', () => {
      const { adapter, ended } = playingAdapter();
      adapter.play(0, 10);
      adapter.seek(2);
      expect(ended).not.toHaveBeenCalled();
      expect(adapter.isPlaying()).toBe(true);
      adapter.stop();
    });

    it('a direct transport.stop() by the consumer is not reported as playback ended', () => {
      // examples and hosts hold adapter.transport and call stop() on it directly
      const { adapter, ended } = playingAdapter();
      adapter.play(0, 10);
      adapter.transport.stop();
      expect(ended).not.toHaveBeenCalled();
    });

    it('unsubscribes with null and never fires after dispose', () => {
      const { ctx, adapter, ended } = playingAdapter();
      adapter.onPlaybackEnded(null);
      adapter.play(0, 1);
      (ctx as any).currentTime = 1.5;
      vi.advanceTimersByTime(DEFAULT_TIMER_INTERVAL_MS);
      expect(ended).not.toHaveBeenCalled();

      const again = vi.fn();
      adapter.onPlaybackEnded(again);
      adapter.play(0, 10);
      adapter.dispose(); // disposes the transport mid-play — a consumer teardown, not completion
      expect(again).not.toHaveBeenCalled();
    });
  });
});
