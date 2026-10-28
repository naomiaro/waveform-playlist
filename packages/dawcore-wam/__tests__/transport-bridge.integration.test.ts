import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Transport, DEFAULT_TIMER_INTERVAL_MS, type Tick } from '@dawcore/transport';
import { createWamTransportBridge } from '../src/transport-bridge';

// The bridge types the transport structurally (TransportQueryLike). This file
// is the one check against the REAL Transport (root CLAUDE.md pattern #11):
// names, event vocabulary and the tick-driven watcher, under the Timer's
// setTimeout fallback (no Worker under vitest) with fake timers.

function createMockAudioContext(): AudioContext {
  const node = () => ({
    gain: { value: 1, linearRampToValueAtTime: vi.fn(), setValueAtTime: vi.fn() },
    pan: { value: 0 },
    channelCount: 1,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    buffer: null,
  });
  return {
    sampleRate: 48000,
    currentTime: 0,
    state: 'running',
    destination: { connect: vi.fn(), disconnect: vi.fn() },
    createGain: vi.fn(node),
    createStereoPanner: vi.fn(node),
    createBufferSource: vi.fn(node),
    createBuffer: vi.fn((channels: number, length: number, sampleRate: number) => ({
      duration: length / sampleRate,
      length,
      sampleRate,
      numberOfChannels: channels,
      getChannelData: () => new Float32Array(length),
    })),
    resume: vi.fn(() => Promise.resolve()),
  } as unknown as AudioContext;
}

function tickData(node: { scheduleEvents: ReturnType<typeof vi.fn> }) {
  const calls = node.scheduleEvents.mock.calls;
  return calls[calls.length - 1][0].data;
}

describe('createWamTransportBridge against a real Transport', () => {
  let ctx: AudioContext;
  let transport: Transport;
  const node = { scheduleEvents: vi.fn() };

  beforeEach(() => {
    vi.useFakeTimers();
    node.scheduleEvents.mockClear();
    ctx = createMockAudioContext();
    transport = new Transport(ctx, { tempo: 120 }); // 1920 ticks = 1 s
  });

  afterEach(() => {
    transport.dispose();
    vi.useRealTimers();
  });

  it('rebroadcasts when playback crosses a tempo-map boundary (no transport event fires)', () => {
    transport.setTempo(90, 1920 as Tick); // 90 bpm from 1 s on
    const bridge = createWamTransportBridge(transport, () => [node]);
    transport.play(0);
    expect(node.scheduleEvents).toHaveBeenCalledTimes(1);
    expect(tickData(node).tempo).toBe(120);

    (ctx as { currentTime: number }).currentTime = 0.5;
    vi.advanceTimersByTime(DEFAULT_TIMER_INTERVAL_MS);
    expect(node.scheduleEvents).toHaveBeenCalledTimes(1);

    (ctx as { currentTime: number }).currentTime = 1.5;
    vi.advanceTimersByTime(DEFAULT_TIMER_INTERVAL_MS);
    expect(node.scheduleEvents).toHaveBeenCalledTimes(2);
    expect(tickData(node).tempo).toBe(90);
    expect(tickData(node).playing).toBe(true);
    bridge.dispose();
  });

  it('rebroadcasts after a loop wrap, which the Transport performs without an event', () => {
    transport.setLoop(true, 0 as Tick, 1920 as Tick); // [0, 1 s)
    const bridge = createWamTransportBridge(transport, () => [node]);
    transport.play(0.5);
    expect(node.scheduleEvents).toHaveBeenCalledTimes(1);

    (ctx as { currentTime: number }).currentTime = 0.1; // position 0.6 s
    vi.advanceTimersByTime(DEFAULT_TIMER_INTERVAL_MS);
    expect(node.scheduleEvents).toHaveBeenCalledTimes(1);

    // Position 0.9 s: the 200 ms lookahead crosses loopEnd → the scheduler
    // wraps and the clamped position reads loopStart again.
    (ctx as { currentTime: number }).currentTime = 0.4;
    vi.advanceTimersByTime(DEFAULT_TIMER_INTERVAL_MS);
    vi.advanceTimersByTime(DEFAULT_TIMER_INTERVAL_MS);
    expect(transport.getCurrentTime()).toBeLessThan(0.5);
    expect(node.scheduleEvents).toHaveBeenCalledTimes(2);
    expect(tickData(node).currentBar).toBe(transport.tickToBar(transport.timeToTick(0)));
    bridge.dispose();
  });

  it('stop/seek/tempochange reach plugins and dispose detaches from the real emitter', () => {
    const bridge = createWamTransportBridge(transport, () => [node]);
    transport.play(0);
    transport.seek(2);
    transport.setTempo(100);
    transport.stop();
    expect(node.scheduleEvents).toHaveBeenCalledTimes(4);
    expect(tickData(node).playing).toBe(false);
    expect(tickData(node).tempo).toBe(100);
    bridge.dispose();
    transport.play(0);
    (ctx as { currentTime: number }).currentTime = 1;
    vi.advanceTimersByTime(DEFAULT_TIMER_INTERVAL_MS);
    expect(node.scheduleEvents).toHaveBeenCalledTimes(4);
  });
});
