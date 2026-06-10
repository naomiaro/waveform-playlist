import { describe, it, expect, vi } from 'vitest';
import { PlaylistEngine } from '../PlaylistEngine';
import type { PlayoutAdapter } from '../types';

interface AdapterHarness {
  adapter: PlayoutAdapter;
  setPosition: (t: number) => void;
}

function makeAdapter(
  opts: { lookAhead?: number; outputLatency?: number | undefined } = {}
): AdapterHarness {
  const lookAhead = opts.lookAhead ?? 0.1;
  // 'in' check, not a destructuring default — an explicit `outputLatency: undefined`
  // must produce a context WITHOUT the property (native-adapter case), and a
  // destructuring default would silently replace it with 0.01.
  const outputLatency = 'outputLatency' in opts ? opts.outputLatency : 0.01;
  let position = 0;
  const audioContext = (outputLatency === undefined
    ? { sampleRate: 48000, state: 'running' }
    : { sampleRate: 48000, state: 'running', outputLatency }) as unknown as AudioContext;
  const adapter: PlayoutAdapter = {
    audioContext,
    ppqn: 960,
    lookAhead,
    init: vi.fn().mockResolvedValue(undefined),
    setTracks: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn((t: number) => {
      position = t;
    }),
    getCurrentTime: vi.fn(() => position),
    isPlaying: vi.fn(() => false),
    setMasterVolume: vi.fn(),
    setTrackVolume: vi.fn(),
    setTrackMute: vi.fn(),
    setTrackSolo: vi.fn(),
    setTrackPan: vi.fn(),
    setLoop: vi.fn(),
    dispose: vi.fn(),
  };
  return {
    adapter,
    setPosition: (t: number) => {
      position = t;
    },
  };
}

describe('PlaylistEngine.getAudibleTime', () => {
  it('returns 0 initially', () => {
    const { adapter } = makeAdapter();
    const engine = new PlaylistEngine({ adapter });
    expect(engine.getAudibleTime()).toBe(0);
    engine.dispose();
  });

  it('returns the exact seeked position while stopped (no compensation)', () => {
    const { adapter } = makeAdapter({ lookAhead: 0.1, outputLatency: 0.01 });
    const engine = new PlaylistEngine({ adapter });
    engine.seek(5);
    expect(engine.getAudibleTime()).toBe(5);
    engine.dispose();
  });

  it('returns the raw pause position (no compensation while resting)', () => {
    const { adapter, setPosition } = makeAdapter({ lookAhead: 0.1, outputLatency: 0.01 });
    const engine = new PlaylistEngine({ adapter });
    engine.play(2);
    setPosition(10);
    engine.pause();
    expect(engine.getAudibleTime()).toBe(10);
    engine.dispose();
  });

  it('returns exactly the play-start position after stop', () => {
    const { adapter, setPosition } = makeAdapter({ lookAhead: 0.1, outputLatency: 0.01 });
    const engine = new PlaylistEngine({ adapter });
    engine.play(3);
    setPosition(8);
    engine.stop();
    expect(engine.getAudibleTime()).toBe(3);
    engine.dispose();
  });

  it('holds at the play-start position during the pre-roll window', () => {
    const { adapter, setPosition } = makeAdapter({ lookAhead: 0.1, outputLatency: 0.01 });
    const engine = new PlaylistEngine({ adapter });
    engine.play(5);
    // raw 5.02 → compensated 5.02 − 0.11 = 4.91 < playStart 5 → hold at 5
    setPosition(5.02);
    expect(engine.getAudibleTime()).toBe(5);
    engine.dispose();
  });

  it('subtracts outputLatency + lookAhead once past the pre-roll window', () => {
    const { adapter, setPosition } = makeAdapter({ lookAhead: 0.1, outputLatency: 0.01 });
    const engine = new PlaylistEngine({ adapter });
    engine.play(5);
    setPosition(5.5);
    expect(engine.getAudibleTime()).toBeCloseTo(5.39, 10);
    engine.dispose();
  });

  it('does not hold when raw drops below play-start (loop wrap)', () => {
    const { adapter, setPosition } = makeAdapter({ lookAhead: 0.1, outputLatency: 0.01 });
    const engine = new PlaylistEngine({ adapter });
    engine.play(5);
    // Transport loop wrapped to a region starting before the play start.
    setPosition(2);
    expect(engine.getAudibleTime()).toBeCloseTo(1.89, 10);
    engine.dispose();
  });

  it('clamps to 0 while playing near time zero', () => {
    const { adapter, setPosition } = makeAdapter({ lookAhead: 0.1, outputLatency: 0.01 });
    const engine = new PlaylistEngine({ adapter });
    engine.play(0);
    setPosition(0);
    // hold condition: raw 0 >= playStart 0 and −0.11 < 0 → hold at 0
    expect(engine.getAudibleTime()).toBe(0);
    engine.dispose();
  });

  it('is a near no-op for native adapters (lookAhead 0, no outputLatency)', () => {
    const { adapter, setPosition } = makeAdapter({ lookAhead: 0, outputLatency: undefined });
    const engine = new PlaylistEngine({ adapter });
    engine.play(1);
    setPosition(4);
    expect(engine.getAudibleTime()).toBe(4);
    engine.dispose();
  });

  it('guards non-finite outputLatency', () => {
    const { adapter, setPosition } = makeAdapter({ lookAhead: 0.1, outputLatency: NaN });
    const engine = new PlaylistEngine({ adapter });
    engine.play(1);
    setPosition(4);
    expect(engine.getAudibleTime()).toBe(0);
    engine.dispose();
  });

  it('returns raw _currentTime with no adapter', () => {
    const engine = new PlaylistEngine();
    engine.seek(7);
    expect(engine.getAudibleTime()).toBe(7);
    engine.dispose();
  });
});
