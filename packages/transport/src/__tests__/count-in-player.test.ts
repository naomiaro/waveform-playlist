import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CountInPlayer } from '../audio/count-in-player';
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

describe('CountInPlayer', () => {
  let ctx: AudioContext;
  let tempoMap: TempoMap;
  let meterMap: MeterMap;
  let destination: AudioNode;
  let accentBuffer: AudioBuffer;
  let normalBuffer: AudioBuffer;

  beforeEach(() => {
    ctx = createMockAudioContext();
    tempoMap = new TempoMap(960, 120);
    meterMap = new MeterMap(960);
    destination = { connect: vi.fn() } as unknown as AudioNode;
    accentBuffer = createMockBuffer();
    normalBuffer = createMockBuffer();
  });

  it('generates correct beat count for 1 bar of 4/4 (4 beats)', () => {
    const player = new CountInPlayer(ctx, tempoMap, destination, (t) => t);
    player.configure({
      totalBeats: 4,
      accentBuffer,
      normalBuffer,
      meterMap,
      tempoMap,
      onBeat: vi.fn(),
    });
    const events = player.generate(0 as Tick, 3840 as Tick);
    expect(events.length).toBe(4);
  });

  it('generates correct beat count for 1 bar of 3/4 (3 beats)', () => {
    const threeQuarterMap = new MeterMap(960, 3, 4);
    const player = new CountInPlayer(ctx, tempoMap, destination, (t) => t);
    player.configure({
      totalBeats: 3,
      accentBuffer,
      normalBuffer,
      meterMap: threeQuarterMap,
      tempoMap,
      onBeat: vi.fn(),
    });
    const events = player.generate(0 as Tick, 2880 as Tick);
    expect(events.length).toBe(3);
  });

  it('generates correct beat count for 1 bar of 6/8 (6 beats)', () => {
    const sixEightMap = new MeterMap(960, 6, 8);
    const player = new CountInPlayer(ctx, tempoMap, destination, (t) => t);
    player.configure({
      totalBeats: 6,
      accentBuffer,
      normalBuffer,
      meterMap: sixEightMap,
      tempoMap,
      onBeat: vi.fn(),
    });
    const events = player.generate(0 as Tick, 2880 as Tick);
    expect(events.length).toBe(6);
  });

  it('beat 1 gets accent buffer, others get normal', () => {
    const player = new CountInPlayer(ctx, tempoMap, destination, (t) => t);
    player.configure({
      totalBeats: 4,
      accentBuffer,
      normalBuffer,
      meterMap,
      tempoMap,
      onBeat: vi.fn(),
    });
    const events = player.generate(0 as Tick, 3840 as Tick);
    expect(events[0].isAccent).toBe(true);
    expect(events[0].buffer).toBe(accentBuffer);
    expect(events[1].isAccent).toBe(false);
    expect(events[1].buffer).toBe(normalBuffer);
    expect(events[2].isAccent).toBe(false);
    expect(events[3].isAccent).toBe(false);
  });

  it('beat field increments 1 through totalBeats', () => {
    const player = new CountInPlayer(ctx, tempoMap, destination, (t) => t);
    player.configure({
      totalBeats: 4,
      accentBuffer,
      normalBuffer,
      meterMap,
      tempoMap,
      onBeat: vi.fn(),
    });
    const events = player.generate(0 as Tick, 3840 as Tick);
    expect(events[0].beat).toBe(1);
    expect(events[0].totalBeats).toBe(4);
    expect(events[1].beat).toBe(2);
    expect(events[2].beat).toBe(3);
    expect(events[3].beat).toBe(4);
    expect(events[3].totalBeats).toBe(4);
  });

  it('multi-bar count-in: 2 bars of 4/4 = 8 beats', () => {
    const player = new CountInPlayer(ctx, tempoMap, destination, (t) => t);
    player.configure({
      totalBeats: 8,
      accentBuffer,
      normalBuffer,
      meterMap,
      tempoMap,
      onBeat: vi.fn(),
    });
    const events = player.generate(0 as Tick, 7680 as Tick);
    expect(events.length).toBe(8);
    expect(events[0].isAccent).toBe(true);
    expect(events[4].isAccent).toBe(true);
  });

  it('onBeat callback fires for each consumed event', () => {
    const onBeat = vi.fn();
    const player = new CountInPlayer(ctx, tempoMap, destination, (t) => t);
    player.configure({
      totalBeats: 4,
      accentBuffer,
      normalBuffer,
      meterMap,
      tempoMap,
      onBeat,
    });
    const events = player.generate(0 as Tick, 3840 as Tick);
    for (const event of events) {
      player.consume(event);
    }
    expect(onBeat).toHaveBeenCalledTimes(4);
    expect(onBeat).toHaveBeenNthCalledWith(1, 1, 4);
    expect(onBeat).toHaveBeenNthCalledWith(4, 4, 4);
  });

  it('consume tracks beats consumed via onBeat', () => {
    const onBeat = vi.fn();
    const player = new CountInPlayer(ctx, tempoMap, destination, (t) => t);
    player.configure({
      totalBeats: 4,
      accentBuffer,
      normalBuffer,
      meterMap,
      tempoMap,
      onBeat,
    });
    const events = player.generate(0 as Tick, 3840 as Tick);
    player.consume(events[0]);
    expect(onBeat).toHaveBeenCalledTimes(1);
    player.consume(events[1]);
    player.consume(events[2]);
    player.consume(events[3]);
    expect(onBeat).toHaveBeenCalledTimes(4);
    expect(onBeat).toHaveBeenLastCalledWith(4, 4);
  });

  it('silence stops all active sources', () => {
    const player = new CountInPlayer(ctx, tempoMap, destination, (t) => t);
    player.configure({
      totalBeats: 4,
      accentBuffer,
      normalBuffer,
      meterMap,
      tempoMap,
      onBeat: vi.fn(),
    });
    const events = player.generate(0 as Tick, 960 as Tick);
    player.consume(events[0]);
    player.silence();
    const source = (ctx.createBufferSource as any).mock.results[0].value;
    expect(source.stop).toHaveBeenCalledTimes(1);
  });

  it('does not generate events beyond totalBeats', () => {
    const player = new CountInPlayer(ctx, tempoMap, destination, (t) => t);
    player.configure({
      totalBeats: 2,
      accentBuffer,
      normalBuffer,
      meterMap,
      tempoMap,
      onBeat: vi.fn(),
    });
    const events = player.generate(0 as Tick, 3840 as Tick);
    expect(events.length).toBe(2);
  });
});
