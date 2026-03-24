import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClipPlayer } from '../audio/clip-player';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { TrackNode } from '../audio/track-node';
import { SampleTimeline } from '../timeline/sample-timeline';

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
    gain: { value: 1, linearRampToValueAtTime: vi.fn(), setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function createMockAudioContext(sampleRate = 48000) {
  return {
    sampleRate,
    currentTime: 0,
    createBufferSource: vi.fn(() => createMockSource()),
    createGain: vi.fn(() => createMockGainNode()),
  } as unknown as AudioContext;
}

function createMockTrackNode(id: string): TrackNode {
  const inputNode = createMockGainNode();
  return {
    id,
    input: inputNode,
  } as unknown as TrackNode;
}

describe('ClipPlayer', () => {
  let ctx: AudioContext;
  let sampleTimeline: SampleTimeline;

  beforeEach(() => {
    ctx = createMockAudioContext();
    sampleTimeline = new SampleTimeline(48000);
  });

  it('generate returns events for clips overlapping the time window', () => {
    const clip = makeClip({ startSample: 0, durationSamples: 48000 }); // 0-1s
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    const events = player.generate(0, 0.5);
    expect(events.length).toBe(1);
    expect(events[0].transportTime).toBe(0);
    expect(events[0].offset).toBe(0);
    expect(events[0].duration).toBeCloseTo(1);
  });

  it('generate skips clips with durationSamples === 0', () => {
    const clip = makeClip({ durationSamples: 0 });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    const events = player.generate(0, 1);
    expect(events.length).toBe(0);
  });

  it('generate skips clips with no audioBuffer (peaks-first)', () => {
    const clip = makeClip({ audioBuffer: undefined });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    const events = player.generate(0, 1);
    expect(events.length).toBe(0);
  });

  it('generate returns [] for empty tracks', () => {
    const track = makeTrack([]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    const events = player.generate(0, 1);
    expect(events.length).toBe(0);
  });

  it('consume calls source.start with correct arguments', () => {
    const clip = makeClip({ startSample: 0, durationSamples: 48000, offsetSamples: 0 });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    const events = player.generate(0, 0.2);
    expect(events.length).toBe(1);

    player.consume(events[0]);
    const source = (ctx.createBufferSource as any).mock.results[0].value;
    expect(source.start).toHaveBeenCalledTimes(1);
    // start(when, offset, duration)
    const [when, offset, duration] = source.start.mock.calls[0];
    expect(when).toBeCloseTo(0);
    expect(offset).toBeCloseTo(0);
    expect(duration).toBeCloseTo(1);
  });

  it('silence stops all active sources', () => {
    const clip = makeClip();
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    const events = player.generate(0, 0.2);
    player.consume(events[0]);

    player.silence();
    const source = (ctx.createBufferSource as any).mock.results[0].value;
    expect(source.stop).toHaveBeenCalledTimes(1);
  });

  it('onPositionJump stops active sources and reschedules mid-clip', () => {
    // Clip spans 0-2s, jump to 0.5s
    const clip = makeClip({
      startSample: 0,
      durationSamples: 96000, // 2s
      offsetSamples: 0,
    });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    // First consume an event
    const events = player.generate(0, 0.2);
    player.consume(events[0]);

    // Jump to mid-clip
    player.onPositionJump(0.5);
    const source = (ctx.createBufferSource as any).mock.results[0].value;
    expect(source.stop).toHaveBeenCalledTimes(1);

    // A new source should be created for mid-clip playback
    expect((ctx.createBufferSource as any).mock.results.length).toBeGreaterThan(1);
  });

  it('does not generate events for clips that end before the window', () => {
    const clip = makeClip({
      startSample: 0,
      durationSamples: 24000, // 0.5s clip
    });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    const events = player.generate(1.0, 1.2); // window after clip
    expect(events.length).toBe(0);
  });

  it('does not re-generate for clips already playing (start before window)', () => {
    const clip = makeClip({
      startSample: 0,
      durationSamples: 96000, // 2s clip starting at 0
      offsetSamples: 0,
    });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    // Window [0.5, 0.7) — clip started at 0, already scheduled
    const events = player.generate(0.5, 0.7);
    expect(events.length).toBe(0);
  });

  it('generate clamps clip duration at loopEnd', () => {
    // 2s clip starting at 0, loop region [0, 1)
    const clip = makeClip({
      startSample: 0,
      durationSamples: 96000, // 2s
      offsetSamples: 0,
    });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));
    player.setLoop(true, 0, 1);

    const events = player.generate(0, 0.2);
    expect(events.length).toBe(1);
    // Duration should be clamped to 1s (loopEnd - clipStart), not full 2s
    expect(events[0].duration).toBeCloseTo(1);
  });

  it('mid-clip playback is handled by onPositionJump, not generate', () => {
    const clip = makeClip({
      startSample: 0,
      durationSamples: 96000, // 2s
      offsetSamples: 0,
    });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    // onPositionJump creates mid-clip source
    player.onPositionJump(0.5);
    // A source should be created for mid-clip playback
    expect((ctx.createBufferSource as any).mock.results.length).toBe(1);
    const source = (ctx.createBufferSource as any).mock.results[0].value;
    const [_when, offset, duration] = source.start.mock.calls[0];
    expect(offset).toBeCloseTo(0.5);
    expect(duration).toBeCloseTo(1.5); // remaining clip
  });
});
