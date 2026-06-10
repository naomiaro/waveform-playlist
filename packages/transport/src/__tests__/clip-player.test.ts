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

  it('onPositionJump does not schedule clips starting exactly at the jump position', () => {
    // Clip starts at 0.5s (24000 samples), jump to exactly 0.5s (tick 960)
    // onPositionJump uses strict < so clips starting AT the position are
    // left for generate() — prevents double-scheduling.
    const clip = makeClip({
      startSample: 24000,
      durationSamples: 48000, // 1s clip
      offsetSamples: 0,
    });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    // Jump to exactly where the clip starts (tick 960 = sample 24000)
    player.onPositionJump(960 as Tick);
    // No source should be created — the clip starts AT the position, not before
    expect((ctx.createBufferSource as any).mock.results.length).toBe(0);
  });

  // --- Tick-based scheduling ---

  it('generate uses startTick for matching when present', () => {
    // Clip at tick 960 (0.5s)
    const clip = makeClip({ startSample: 24000, startTick: 960, durationSamples: 48000 });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    // Window [0, 480) — before clip, should not match
    expect(player.generate(0 as Tick, 480 as Tick)).toHaveLength(0);

    // Window [480, 1440) — clip at tick 960 should match
    const events = player.generate(480 as Tick, 1440 as Tick);
    expect(events).toHaveLength(1);
    expect(events[0].tick).toBe(960);
  });

  it('generate uses startTick directly for event.tick', () => {
    const clip = makeClip({ startSample: 24000, startTick: 960, durationSamples: 48000 });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    const events = player.generate(0 as Tick, 1920 as Tick);
    // event.tick should come from clip.startTick, not derived from samples
    expect(events[0].tick).toBe(960);
  });

  it('onPositionJump detects mid-clip using startTick', () => {
    const clip = makeClip({
      startSample: 0,
      startTick: 0,
      durationSamples: 96000, // 2s
    });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    // Jump to tick 960 — clip starts at tick 0, should create mid-clip source
    player.onPositionJump(960 as Tick);
    expect((ctx.createBufferSource as any).mock.results.length).toBe(1);
  });

  it('onPositionJump skips clips starting at or after jump tick', () => {
    const clip = makeClip({
      startSample: 24000,
      startTick: 960,
      durationSamples: 48000,
    });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    // Jump to tick 960 — clip starts AT this tick, should not create mid-clip
    player.onPositionJump(960 as Tick);
    expect((ctx.createBufferSource as any).mock.results.length).toBe(0);
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

// ---------------------------------------------------------------------------
// Sample-rate unit regression tests: offsetSamples/durationSamples index the
// BUFFER (its own rate); startSample and the loop boundary live on the
// TIMELINE (the SampleTimeline rate); Fade.duration is SECONDS. These were
// conflated when buffer rate == timeline rate — the default decodeAudioData
// path — and silently wrong otherwise (e.g. a 48 kHz Opus on a 44.1 kHz
// timeline started trimmed clips ~8.8% too deep).
// ---------------------------------------------------------------------------
describe('ClipPlayer sample-rate domains', () => {
  function make441Setup() {
    const ctx = createMockAudioContext(44100);
    const tempoMap = new TempoMap(960, 120);
    const sampleTimeline = new SampleTimeline(44100);
    sampleTimeline.setTempoMap(tempoMap);
    return { ctx, tempoMap, sampleTimeline };
  }

  function make48kBufferClip(overrides: Partial<AudioClip> = {}): AudioClip {
    return makeClip({
      sampleRate: 48000,
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
    });
  }

  it('consume divides offset/duration by the BUFFER rate, not the timeline rate', () => {
    const { ctx, tempoMap, sampleTimeline } = make441Setup();
    // 1s trim offset and 1s duration, expressed in 48 kHz buffer samples,
    // played on a 44.1 kHz timeline.
    const clip = make48kBufferClip({
      startSample: 0,
      offsetSamples: 48000,
      durationSamples: 48000,
    });
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([makeTrack([clip])], new Map([['track-1', createMockTrackNode('track-1')]]));

    const events = player.generate(0 as Tick, 960 as Tick);
    expect(events.length).toBe(1);
    player.consume(events[0]);

    const source = (ctx.createBufferSource as any).mock.results[0].value;
    const [, offset, duration] = source.start.mock.calls[0];
    // 48000 buffer samples at 48 kHz = exactly 1 second. Dividing by the
    // timeline rate would give 48000/44100 = 1.0884s — too deep / too long.
    expect(offset).toBeCloseTo(1.0, 9);
    expect(duration).toBeCloseTo(1.0, 9);
  });

  it('onPositionJump converts the timeline offset into buffer samples', () => {
    const { ctx, tempoMap, sampleTimeline } = make441Setup();
    // Clip at timeline 0, 2s of 48 kHz audio (96000 buffer samples).
    const clip = make48kBufferClip({
      startSample: 0,
      offsetSamples: 0,
      durationSamples: 96000,
    });
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([makeTrack([clip])], new Map([['track-1', createMockTrackNode('track-1')]]));

    // Jump to 1.0s = 1920 ticks at 120 BPM.
    player.onPositionJump(1920 as Tick);

    const source = (ctx.createBufferSource as any).mock.results[0].value;
    const [, offset, duration] = source.start.mock.calls[0];
    // 1s into the clip = 48000 BUFFER samples of offset (not 44100), and
    // 1s remains of the 2s clip.
    expect(offset).toBeCloseTo(1.0, 4);
    expect(duration).toBeCloseTo(1.0, 4);
  });

  it('treats Fade.duration as seconds, matching the Tone adapter convention', () => {
    const ctx = createMockAudioContext();
    const tempoMap = new TempoMap(960, 120);
    const sampleTimeline = new SampleTimeline(48000);
    sampleTimeline.setTempoMap(tempoMap);
    const clip = makeClip({
      startSample: 0,
      durationSamples: 48000,
      fadeIn: { duration: 0.25 },
      fadeOut: { duration: 0.25 },
    });
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([makeTrack([clip])], new Map([['track-1', createMockTrackNode('track-1')]]));

    const events = player.generate(0 as Tick, 960 as Tick);
    player.consume(events[0]);

    const gainNode = (ctx.createGain as any).mock.results[0].value;
    // Fade-in ramps from 0 at `when` to gain at `when + 0.25` SECONDS.
    // The old code read 0.25 as samples: 0.25/48000 ≈ 5.2 microseconds.
    const rampCalls = gainNode.gain.linearRampToValueAtTime.mock.calls;
    expect(rampCalls.length).toBeGreaterThan(0);
    expect(rampCalls[0][1]).toBeCloseTo(0.25, 9);
  });
});
