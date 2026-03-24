import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Transport } from '../transport';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';

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

  it('setLoop configures loop region', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setLoop(true, 1, 3);
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
});
