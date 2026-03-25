import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClipPlayer } from '../audio/clip-player';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { TrackNode } from '../audio/track-node';
import { SampleTimeline } from '../timeline/sample-timeline';
import { TempoMap } from '../timeline/tempo-map';
import type { Tick, Sample } from '../types';

// At 120 BPM, 960 PPQN, 48kHz:
// 0.5s = 960 ticks  = 24000 samples
// 1.0s = 1920 ticks = 48000 samples
// 1.2s = 2304 ticks = 57600 samples
// 0.2s =  384 ticks =  9600 samples
// 0.7s = 1344 ticks = 33600 samples
// 2.0s = 3840 ticks = 96000 samples

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
  let tempoMap: TempoMap;

  beforeEach(() => {
    ctx = createMockAudioContext();
    // 120 BPM, 960 PPQN
    tempoMap = new TempoMap(960, 120);
    sampleTimeline = new SampleTimeline(48000);
    sampleTimeline.setTempoMap(tempoMap);
  });

  it('generate returns events for clips overlapping the time window', () => {
    const clip = makeClip({ startSample: 0, durationSamples: 48000 }); // 0-1s
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    // Window [0, 960 ticks) = [0, 0.5s)
    const events = player.generate(0 as Tick, 960 as Tick);
    expect(events.length).toBe(1);
    expect(events[0].tick).toBe(0);
    expect(events[0].durationSamples).toBe(48000);
  });

  it('generate skips clips with durationSamples === 0', () => {
    const clip = makeClip({ durationSamples: 0 });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    const events = player.generate(0 as Tick, 1920 as Tick);
    expect(events.length).toBe(0);
  });

  it('generate skips clips with no audioBuffer (peaks-first)', () => {
    const clip = makeClip({ audioBuffer: undefined });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    const events = player.generate(0 as Tick, 1920 as Tick);
    expect(events.length).toBe(0);
  });

  it('generate returns [] for empty tracks', () => {
    const track = makeTrack([]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    const events = player.generate(0 as Tick, 1920 as Tick);
    expect(events.length).toBe(0);
  });

  it('consume calls source.start with correct arguments (seconds)', () => {
    const clip = makeClip({ startSample: 0, durationSamples: 48000, offsetSamples: 0 });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    // Window [0, 384 ticks) = [0, 0.2s)
    const events = player.generate(0 as Tick, 384 as Tick);
    expect(events.length).toBe(1);

    player.consume(events[0]);
    const source = (ctx.createBufferSource as any).mock.results[0].value;
    expect(source.start).toHaveBeenCalledTimes(1);
    // start(when, offset, duration) — all in seconds
    const [when, offset, duration] = source.start.mock.calls[0];
    expect(when).toBeCloseTo(0);
    expect(offset).toBeCloseTo(0); // offsetSamples=0 → 0s
    expect(duration).toBeCloseTo(1); // durationSamples=48000 → 1s at 48kHz
  });

  it('silence stops all active sources', () => {
    const clip = makeClip();
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    // Window [0, 384 ticks) = [0, 0.2s)
    const events = player.generate(0 as Tick, 384 as Tick);
    player.consume(events[0]);

    player.silence();
    const source = (ctx.createBufferSource as any).mock.results[0].value;
    expect(source.stop).toHaveBeenCalledTimes(1);
  });

  it('onPositionJump stops active sources and reschedules mid-clip', () => {
    // Clip spans 0-2s, jump to tick 960 (0.5s)
    const clip = makeClip({
      startSample: 0,
      durationSamples: 96000, // 2s
      offsetSamples: 0,
    });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    // First consume an event
    const events = player.generate(0 as Tick, 384 as Tick);
    player.consume(events[0]);

    // Jump to mid-clip (tick 960 = 0.5s)
    player.onPositionJump(960 as Tick);
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
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    // Window [1920, 2304) ticks = [1.0s, 1.2s) — after clip ends at 0.5s
    const events = player.generate(1920 as Tick, 2304 as Tick);
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
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    // Window [960, 1344) ticks = [0.5s, 0.7s) — clip started at 0, already scheduled
    const events = player.generate(960 as Tick, 1344 as Tick);
    expect(events.length).toBe(0);
  });

  it('generate clamps clip duration at loopEnd', () => {
    // 2s clip starting at 0, loop region [0, 48000 samples) = [0, 1s)
    const clip = makeClip({
      startSample: 0,
      durationSamples: 96000, // 2s
      offsetSamples: 0,
    });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));
    // setLoopSamples: loop ends at 48000 samples = 1s
    player.setLoopSamples(true, 0 as Sample, 48000 as Sample);

    // Window [0, 384) ticks = [0, 0.2s)
    const events = player.generate(0 as Tick, 384 as Tick);
    expect(events.length).toBe(1);
    // Duration should be clamped to 48000 samples (1s), not full 96000 (2s)
    expect(events[0].durationSamples).toBe(48000);
  });

  it('mid-clip playback is handled by onPositionJump, not generate', () => {
    const clip = makeClip({
      startSample: 0,
      durationSamples: 96000, // 2s
      offsetSamples: 0,
    });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    // onPositionJump at tick 960 = 0.5s
    player.onPositionJump(960 as Tick);
    // A source should be created for mid-clip playback
    expect((ctx.createBufferSource as any).mock.results.length).toBe(1);
    const source = (ctx.createBufferSource as any).mock.results[0].value;
    const [_when, offset, duration] = source.start.mock.calls[0];
    // offset = 0.5s into clip (offsetSamples=0, then 0.5s into clip)
    expect(offset).toBeCloseTo(0.5);
    // duration = remaining 1.5s of 2s clip
    expect(duration).toBeCloseTo(1.5);
  });
});
