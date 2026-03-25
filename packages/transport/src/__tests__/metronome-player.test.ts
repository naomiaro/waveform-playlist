import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetronomePlayer } from '../audio/metronome-player';
import { TempoMap } from '../timeline/tempo-map';
import { MeterMap } from '../timeline/meter-map';
import type { Tick } from '../types';

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

    // At 120 BPM, 960 PPQN: 1 beat = 960 ticks = 0.5s
    // generate(0, 2112) covers ticks 0..2111 → beats at 0, 960, 1920
    const events = player.generate(0 as Tick, 2112 as Tick);
    expect(events.length).toBe(3);
    expect(events[0].tick).toBe(0);
    expect(events[1].tick).toBe(960);
    expect(events[2].tick).toBe(1920);
  });

  it('accent on beat 1 of each bar', () => {
    const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
    player.setEnabled(true);

    const accent = createMockBuffer();
    const normal = createMockBuffer();
    player.setClickSounds(accent, normal);

    // At 120 BPM, 4/4: 1 bar = 4 beats = 3840 ticks = 2s
    // generate(0, 4032) covers ticks 0..4031 → beats at 0, 960, 1920, 2880, 3840
    const events = player.generate(0 as Tick, 4032 as Tick);
    expect(events[0].isAccent).toBe(true); // beat 1 of bar 1
    expect(events[1].isAccent).toBe(false); // beat 2
    expect(events[2].isAccent).toBe(false); // beat 3
    expect(events[3].isAccent).toBe(false); // beat 4
    expect(events[4].isAccent).toBe(true); // beat 1 of bar 2
  });

  it('setEnabled(false) produces no events', () => {
    const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
    player.setEnabled(false);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    const events = player.generate(0 as Tick, 3840 as Tick);
    expect(events.length).toBe(0);
  });

  it('consume creates and starts a source', () => {
    const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    // 0.2s = 384 ticks at 120 BPM, 960 PPQN
    const events = player.generate(0 as Tick, 384 as Tick);
    expect(events.length).toBe(1);
    player.consume(events[0]);

    const source = (ctx.createBufferSource as any).mock.results[0].value;
    expect(source.start).toHaveBeenCalledTimes(1);
  });

  it('silence stops active sources', () => {
    const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    const events = player.generate(0 as Tick, 384 as Tick);
    player.consume(events[0]);
    player.silence();

    const source = (ctx.createBufferSource as any).mock.results[0].value;
    expect(source.stop).toHaveBeenCalledTimes(1);
  });

  it('onPositionJump does not silence — clicks are short one-shots', () => {
    const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    const events = player.generate(0 as Tick, 384 as Tick);
    player.consume(events[0]);
    player.onPositionJump(1920 as Tick);

    // Clicks should NOT be stopped on position jump — they finish naturally.
    // Only silence() (stop/pause) kills active sources.
    const source = (ctx.createBufferSource as any).mock.results[0].value;
    expect(source.stop).not.toHaveBeenCalled();
  });

  it('generates beats using MeterMap beat size (6/8 = eighth notes)', () => {
    const sixEightMap = new MeterMap(960, 6, 8);
    const player = new MetronomePlayer(ctx, tempoMap, sixEightMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    // At 120 BPM, 6/8: beat = eighth note = 480 ticks = 0.25s
    // generate(0, 1152) covers 0..1151 → beats at 0, 480, 960
    const events = player.generate(0 as Tick, 1152 as Tick);
    expect(events.length).toBe(3);
    expect(events[0].tick).toBe(0);
    expect(events[1].tick).toBe(480);
  });

  it('accents on bar boundaries with mixed meters', () => {
    const mixedMap = new MeterMap(960);
    mixedMap.setMeter(3, 4, 3840); // switch to 3/4 at bar 2
    const player = new MetronomePlayer(ctx, tempoMap, mixedMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    // Bar 1 (4/4): beats at 0, 960, 1920, 2880 — accent at 0
    // Bar 2 (3/4): beats at 3840, 4800, 5760 — accent at 3840
    // generate(0, 5952) covers 0..5951
    const events = player.generate(0 as Tick, 5952 as Tick);
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

    // Bar 1 (4/4): quarter-note beats every 960 ticks (0, 960, 1920, 2880)
    // Bar 2 (6/8): eighth-note beats every 480 ticks starting at 3840
    // generate(0, 6720) covers 0..6719
    const events = player.generate(0 as Tick, 6720 as Tick);

    // Bar 1: quarter-note beats
    expect(events[0].tick).toBe(0);
    expect(events[1].tick).toBe(960);
    expect(events[3].tick).toBe(2880);

    // Bar 2: eighth-note beats starting at 3840
    expect(events[4].tick).toBe(3840);
    expect(events[5].tick).toBe(4320);
    expect(events[6].tick).toBe(4800);
  });

  it('generate with mid-beat fromTick snaps to next beat', () => {
    const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    // At 120 BPM, 4/4: beats at 0, 960, 1920...
    // 0.3s = 576 ticks — mid-beat, should snap to next beat at 960
    // generate(576, 2112) → beats at 960, 1920
    const events = player.generate(576 as Tick, 2112 as Tick);
    expect(events.length).toBe(2);
    expect(events[0].tick).toBe(960);
    expect(events[1].tick).toBe(1920);
  });

  it('8-bar loop generates exactly 8 downbeats (half-open interval)', () => {
    const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    // 8 bars of 4/4 at 960 PPQN = 8 * 4 * 960 = 30720 ticks
    // Half-open interval [0, 30720) — tick 30720 (bar 9 beat 1) must NOT be included
    const events = player.generate(0 as Tick, 30720 as Tick);

    // 8 bars × 4 beats = 32 total beats
    expect(events.length).toBe(32);

    // Exactly 8 downbeats (one per bar)
    const downbeats = events.filter((e) => e.isAccent);
    expect(downbeats.length).toBe(8);

    // First downbeat at tick 0, last at tick 7 * 3840 = 26880
    expect(downbeats[0].tick).toBe(0);
    expect(downbeats[7].tick).toBe(26880);
  });
});
