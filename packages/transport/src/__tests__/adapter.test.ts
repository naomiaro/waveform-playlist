import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NativePlayoutAdapter } from '../adapter';
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
  beforeEach(() => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((_cb: (time: number) => void) => 1)
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
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

  it('init warmup loop polls until currentTime advances', async () => {
    const ctx = mockAudioContext();
    // Override: resume does NOT advance currentTime (simulates Safari warmup)
    let rafCallback: ((time: number) => void) | null = null;
    (ctx as any).resume = vi.fn(() => {
      (ctx as any).state = 'running';
      // currentTime stays at 0 — warmup loop must poll
      return Promise.resolve();
    });
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: (time: number) => void) => {
        rafCallback = cb;
        return 1;
      })
    );

    const adapter = new NativePlayoutAdapter(ctx);
    let resolved = false;
    const initPromise = adapter.init().then(() => {
      resolved = true;
    });

    // Wait for resume() microtask to settle
    await Promise.resolve();
    await Promise.resolve();

    // Warmup should be polling — not yet resolved
    expect(resolved).toBe(false);
    expect(rafCallback).not.toBeNull();

    // Advance currentTime past warmup target and fire the rAF callback
    (ctx as any).currentTime = 0.05;
    rafCallback!(0);

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
    const originalNow = performance.now;
    let mockNow = 0;
    vi.stubGlobal('performance', { now: () => mockNow });

    let rafCallback: ((time: number) => void) | null = null;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: (time: number) => void) => {
        rafCallback = cb;
        return 1;
      })
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const adapter = new NativePlayoutAdapter(ctx);
    const initPromise = adapter.init();

    await Promise.resolve();
    await Promise.resolve();

    // Jump past 2s timeout and fire callback
    mockNow = 3000;
    rafCallback!(0);

    await initPromise;
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('warmup timed out'));

    warnSpy.mockRestore();
    vi.stubGlobal('performance', { now: originalNow });
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
    adapter.setLoop(true, 1, 5);
    // Should not throw
  });

  it('delegates dispose', () => {
    const ctx = mockAudioContext();
    const adapter = new NativePlayoutAdapter(ctx);
    adapter.dispose();
    expect(adapter.isPlaying()).toBe(false);
  });
});
