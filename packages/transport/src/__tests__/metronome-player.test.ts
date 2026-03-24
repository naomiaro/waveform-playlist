import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetronomePlayer } from '../audio/metronome-player';
import { TempoMap } from '../timeline/tempo-map';
import { MeterMap } from '../timeline/meter-map';

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
  let meterMap: MeterMap;
  let destination: AudioNode;

  beforeEach(() => {
    ctx = createMockAudioContext();
    tempoMap = new TempoMap(960, 120);
    meterMap = new MeterMap(960);
    destination = { connect: vi.fn() } as unknown as AudioNode;
  });

  it('generate produces beat events at correct times', () => {
    const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
    player.setEnabled(true);
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
    const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
    player.setEnabled(true);

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
    const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
    player.setEnabled(false);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    const events = player.generate(0, 2);
    expect(events.length).toBe(0);
  });

  it('consume creates and starts a source', () => {
    const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    const events = player.generate(0, 0.2);
    expect(events.length).toBe(1);
    player.consume(events[0]);

    const source = (ctx.createBufferSource as any).mock.results[0].value;
    expect(source.start).toHaveBeenCalledTimes(1);
  });

  it('silence stops active sources', () => {
    const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    const events = player.generate(0, 0.2);
    player.consume(events[0]);
    player.silence();

    const source = (ctx.createBufferSource as any).mock.results[0].value;
    expect(source.stop).toHaveBeenCalledTimes(1);
  });

  it('onPositionJump clears active sources', () => {
    const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    const events = player.generate(0, 0.2);
    player.consume(events[0]);
    player.onPositionJump(1.0);

    const source = (ctx.createBufferSource as any).mock.results[0].value;
    expect(source.stop).toHaveBeenCalledTimes(1);
  });

  it('generates beats using MeterMap beat size (6/8 = eighth notes)', () => {
    const sixEightMap = new MeterMap(960, 6, 8);
    const player = new MetronomePlayer(ctx, tempoMap, sixEightMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    // At 120 BPM, 6/8: beat = eighth note = 0.25s
    const events = player.generate(0, 0.6);
    // Should get beats at 0.0, 0.25, 0.5 (3 eighth-note beats)
    expect(events.length).toBe(3);
    expect(events[0].transportTime).toBeCloseTo(0.0);
    expect(events[1].transportTime).toBeCloseTo(0.25);
  });

  it('accents on bar boundaries with mixed meters', () => {
    const mixedMap = new MeterMap(960);
    mixedMap.setMeter(3, 4, 3840); // switch to 3/4 at bar 2
    const player = new MetronomePlayer(ctx, tempoMap, mixedMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    // Bar 1 (4/4): beats at 0, 0.5, 1.0, 1.5 — accent at 0
    // Bar 2 (3/4): beats at 2.0, 2.5, 3.0 — accent at 2.0
    const events = player.generate(0, 3.1);
    expect(events[0].isAccent).toBe(true); // beat 1 of bar 1
    expect(events[1].isAccent).toBe(false); // beat 2
    expect(events[4].isAccent).toBe(true); // beat 1 of bar 2 (3/4)
    // Bar 2 should have 3 beats (not 4)
    expect(events[5].isAccent).toBe(false); // beat 2 of bar 2
    expect(events[6].isAccent).toBe(false); // beat 3 of bar 2
  });

  it('beat step size changes at meter boundary within scheduling window', () => {
    const mixedMap = new MeterMap(960);
    mixedMap.setMeter(6, 8, 3840); // switch to 6/8 at bar 2
    const player = new MetronomePlayer(ctx, tempoMap, mixedMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    // At 120 BPM: bar 1 (4/4) beats every 0.5s, bar 2 (6/8) beats every 0.25s
    const events = player.generate(0, 3.5);

    // Bar 1: 4 quarter-note beats (0.0, 0.5, 1.0, 1.5)
    expect(events[0].transportTime).toBeCloseTo(0.0);
    expect(events[1].transportTime).toBeCloseTo(0.5);
    expect(events[3].transportTime).toBeCloseTo(1.5);

    // Bar 2: 6 eighth-note beats starting at 2.0 (0.25s apart)
    expect(events[4].transportTime).toBeCloseTo(2.0);
    expect(events[5].transportTime).toBeCloseTo(2.25);
    expect(events[6].transportTime).toBeCloseTo(2.5);
  });

  it('generate with mid-beat fromTime snaps to next beat', () => {
    const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    // At 120 BPM, 4/4: beats at 0.0, 0.5, 1.0, 1.5...
    // Starting mid-beat at 0.3 should snap to 0.5
    const events = player.generate(0.3, 1.1);
    expect(events.length).toBe(2); // 0.5, 1.0
    expect(events[0].transportTime).toBeCloseTo(0.5);
    expect(events[1].transportTime).toBeCloseTo(1.0);
  });
});
