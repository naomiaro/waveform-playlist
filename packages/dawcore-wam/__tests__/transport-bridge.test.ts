import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWamTransportBridge } from '../src/transport-bridge';

type Listener = (...args: unknown[]) => void;

function makeMockTransport() {
  const listeners = new Map<string, Set<Listener>>();
  const transport = {
    audioContext: { currentTime: 100 },
    _playing: false,
    _tempo: 120,
    _meter: { numerator: 4, denominator: 4 },
    _seconds: 10,
    isPlaying: vi.fn(function (this: void) {
      return transport._playing;
    }),
    getCurrentTime: vi.fn(() => transport._seconds),
    getTempo: vi.fn(() => transport._tempo),
    getMeter: vi.fn(() => transport._meter),
    timeToTick: vi.fn((s: number) => Math.round(s * 960 * 2)), // 120bpm: 2 beats/s
    tickToTime: vi.fn((t: number) => t / (960 * 2)),
    tickToBar: vi.fn(() => 6), // pretend we're in bar 6
    barToTick: vi.fn(() => 8 * 960 * 2), // bar 6 began at 8s worth of ticks
    on: vi.fn((event: string, cb: Listener) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(cb);
    }),
    off: vi.fn((event: string, cb: Listener) => {
      listeners.get(event)?.delete(cb);
    }),
    emit(event: string) {
      for (const cb of listeners.get(event) ?? []) cb();
    },
  };
  return transport;
}

function makeMockNode() {
  return { scheduleEvents: vi.fn() };
}

let rafCallbacks: Array<(t: number) => void>;

beforeEach(() => {
  rafCallbacks = [];
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((cb: (t: number) => void) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    })
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function pumpFrame() {
  const snapshot = [...rafCallbacks];
  rafCallbacks = [];
  for (const cb of snapshot) cb(performance.now());
}

function lastEvent(node: ReturnType<typeof makeMockNode>) {
  const calls = node.scheduleEvents.mock.calls;
  return calls[calls.length - 1][0];
}

describe('createWamTransportBridge', () => {
  it('broadcasts a correctly shaped wam-transport event on play', () => {
    const transport = makeMockTransport();
    const node = makeMockNode();
    createWamTransportBridge(transport, () => [node]);

    transport._playing = true;
    transport.emit('play');

    const event = lastEvent(node);
    expect(event.type).toBe('wam-transport');
    expect(event.data).toEqual({
      playing: true,
      tempo: 120,
      timeSigNumerator: 4,
      timeSigDenominator: 4,
      currentBar: 6,
      // bar began 2s ago in transport time (10s - 8s) → audio time 100 - 2 = 98
      currentBarStarted: 98,
    });
  });

  it('broadcasts playing:false on stop and pause', () => {
    const transport = makeMockTransport();
    const node = makeMockNode();
    createWamTransportBridge(transport, () => [node]);

    transport._playing = false;
    transport.emit('stop');
    expect(lastEvent(node).data.playing).toBe(false);

    transport.emit('pause');
    expect(node.scheduleEvents).toHaveBeenCalledTimes(2);
  });

  it('rebroadcasts on tempochange, meterchange, and seek', () => {
    const transport = makeMockTransport();
    const node = makeMockNode();
    createWamTransportBridge(transport, () => [node]);

    transport._tempo = 140;
    transport.emit('tempochange');
    expect(lastEvent(node).data.tempo).toBe(140);

    transport._meter = { numerator: 3, denominator: 4 };
    transport.emit('meterchange');
    expect(lastEvent(node).data.timeSigNumerator).toBe(3);

    transport.emit('seek');
    expect(node.scheduleEvents).toHaveBeenCalledTimes(3);
  });

  it('notifyNodeAdded sends a fresh event to just that node', () => {
    const transport = makeMockTransport();
    const existing = makeMockNode();
    const bridge = createWamTransportBridge(transport, () => [existing]);

    const added = makeMockNode();
    bridge.notifyNodeAdded(added);

    expect(added.scheduleEvents).toHaveBeenCalledTimes(1);
    expect(existing.scheduleEvents).not.toHaveBeenCalled();
    expect(lastEvent(added).type).toBe('wam-transport');
  });

  it('detects a tempo-map boundary crossing during playback and rebroadcasts', () => {
    const transport = makeMockTransport();
    const node = makeMockNode();
    createWamTransportBridge(transport, () => [node]);

    transport._playing = true;
    transport.emit('play');
    expect(node.scheduleEvents).toHaveBeenCalledTimes(1);

    // Playback crosses into a 90bpm segment — no transport event fires,
    // only the playing watcher can notice.
    transport._tempo = 90;
    pumpFrame();

    expect(node.scheduleEvents).toHaveBeenCalledTimes(2);
    expect(lastEvent(node).data.tempo).toBe(90);

    // No further change → no further broadcast.
    pumpFrame();
    expect(node.scheduleEvents).toHaveBeenCalledTimes(2);
  });

  it('a bridge created while ALREADY playing starts watching immediately', () => {
    const transport = makeMockTransport();
    transport._playing = true; // play fired before the bridge existed
    const node = makeMockNode();
    createWamTransportBridge(transport, () => [node]);

    // Creation broadcasts the current state (plugins sync without a new play)...
    expect(node.scheduleEvents).toHaveBeenCalledTimes(1);

    // ...and the boundary watcher is live.
    transport._tempo = 75;
    pumpFrame();
    expect(node.scheduleEvents).toHaveBeenCalledTimes(2);
    expect(lastEvent(node).data.tempo).toBe(75);
  });

  it('stops the watcher on stop and unsubscribes everything on dispose', () => {
    const transport = makeMockTransport();
    const node = makeMockNode();
    const bridge = createWamTransportBridge(transport, () => [node]);

    transport._playing = true;
    transport.emit('play');
    transport._playing = false;
    transport.emit('stop');
    const countAfterStop = node.scheduleEvents.mock.calls.length;

    transport._tempo = 80;
    pumpFrame();
    expect(node.scheduleEvents).toHaveBeenCalledTimes(countAfterStop);

    bridge.dispose();
    transport.emit('play');
    transport.emit('tempochange');
    expect(node.scheduleEvents).toHaveBeenCalledTimes(countAfterStop);
    expect(transport.off).toHaveBeenCalled();
  });
});
