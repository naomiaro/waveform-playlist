import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetronomePlayer } from '../audio/metronome-player';
import { TempoMap } from '../timeline/tempo-map';
import { TickTimeline } from '../timeline/tick-timeline';

function createMockSource() {
  return {
    buffer: null as AudioBuffer | null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    addEventListener: vi.fn(),
  };
}

function createMockAudioContext() {
  return {
    sampleRate: 48000,
    currentTime: 0,
    createBufferSource: vi.fn(() => createMockSource()),
  } as unknown as AudioContext;
}

function createMockBuffer(): AudioBuffer {
  return {
    duration: 0.05,
    length: 2400,
    sampleRate: 48000,
    numberOfChannels: 1,
  } as unknown as AudioBuffer;
}

describe('MetronomePlayer', () => {
  let ctx: AudioContext;
  let tempoMap: TempoMap;
  let tickTimeline: TickTimeline;
  let destination: AudioNode;

  beforeEach(() => {
    ctx = createMockAudioContext();
    tempoMap = new TempoMap(960, 120);
    tickTimeline = new TickTimeline(960);
    destination = { connect: vi.fn() } as unknown as AudioNode;
  });

  it('generate produces beat events at correct times', () => {
    const player = new MetronomePlayer(ctx, tempoMap, tickTimeline, destination, (t) => t);
    player.setEnabled(true);
    player.setBeatsPerBar(4);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    // At 120 BPM, beats are at 0, 0.5, 1.0, 1.5, 2.0...
    const events = player.generate(0, 1.1);
    // Should get beats at 0.0, 0.5, 1.0
    expect(events.length).toBe(3);
    expect(events[0].transportTime).toBeCloseTo(0.0);
    expect(events[1].transportTime).toBeCloseTo(0.5);
    expect(events[2].transportTime).toBeCloseTo(1.0);
  });

  it('accent on beat 1 of each bar', () => {
    const player = new MetronomePlayer(ctx, tempoMap, tickTimeline, destination, (t) => t);
    player.setEnabled(true);
    player.setBeatsPerBar(4);
    const accent = createMockBuffer();
    const normal = createMockBuffer();
    player.setClickSounds(accent, normal);

    // At 120 BPM, 4/4, bar = 4 beats = 2s
    const events = player.generate(0, 2.1);
    // Beats: 0.0(accent), 0.5, 1.0, 1.5, 2.0(accent)
    expect(events[0].isAccent).toBe(true);
    expect(events[1].isAccent).toBe(false);
    expect(events[2].isAccent).toBe(false);
    expect(events[3].isAccent).toBe(false);
    expect(events[4].isAccent).toBe(true);
  });

  it('setEnabled(false) produces no events', () => {
    const player = new MetronomePlayer(ctx, tempoMap, tickTimeline, destination, (t) => t);
    player.setEnabled(false);
    player.setClickSounds(createMockBuffer(), createMockBuffer());
    player.setBeatsPerBar(4);

    const events = player.generate(0, 2);
    expect(events.length).toBe(0);
  });

  it('consume creates and starts a source', () => {
    const player = new MetronomePlayer(ctx, tempoMap, tickTimeline, destination, (t) => t);
    player.setEnabled(true);
    player.setBeatsPerBar(4);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    const events = player.generate(0, 0.2);
    expect(events.length).toBe(1);
    player.consume(events[0]);

    const source = (ctx.createBufferSource as any).mock.results[0].value;
    expect(source.start).toHaveBeenCalledTimes(1);
  });

  it('silence stops active sources', () => {
    const player = new MetronomePlayer(ctx, tempoMap, tickTimeline, destination, (t) => t);
    player.setEnabled(true);
    player.setBeatsPerBar(4);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    const events = player.generate(0, 0.2);
    player.consume(events[0]);
    player.silence();

    const source = (ctx.createBufferSource as any).mock.results[0].value;
    expect(source.stop).toHaveBeenCalledTimes(1);
  });

  it('onPositionJump clears active sources', () => {
    const player = new MetronomePlayer(ctx, tempoMap, tickTimeline, destination, (t) => t);
    player.setEnabled(true);
    player.setBeatsPerBar(4);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    const events = player.generate(0, 0.2);
    player.consume(events[0]);
    player.onPositionJump(1.0);

    const source = (ctx.createBufferSource as any).mock.results[0].value;
    expect(source.stop).toHaveBeenCalledTimes(1);
  });
});
