import { describe, it, expect, vi, beforeEach } from 'vitest';

interface MockGain {
  kind: 'gain';
  gain: { value: number };
  connect: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  channelCount?: number;
  channelCountMode?: string;
  channelInterpretation?: string;
}

const created: { gains: MockGain[]; splits: unknown[]; merges: unknown[] } = {
  gains: [],
  splits: [],
  merges: [],
};

vi.mock('tone', () => ({
  Gain: vi.fn(function (options: { gain: number }) {
    const node: MockGain = {
      kind: 'gain',
      gain: { value: options.gain },
      connect: vi.fn(),
      dispose: vi.fn(),
    };
    created.gains.push(node);
    return node;
  }),
  Split: vi.fn(function () {
    const node = { kind: 'split', connect: vi.fn(), dispose: vi.fn() };
    created.splits.push(node);
    return node;
  }),
  Merge: vi.fn(function () {
    const node = { kind: 'merge', connect: vi.fn(), dispose: vi.fn() };
    created.merges.push(node);
    return node;
  }),
}));

import { createTrackPanStage, panMatrix } from '../trackPan';

const SQRT_HALF = Math.SQRT1_2;

beforeEach(() => {
  created.gains.length = 0;
  created.splits.length = 0;
  created.merges.length = 0;
});

/** Apply a pan matrix to one stereo frame. */
function pan(m: ReturnType<typeof panMatrix>, left: number, right: number) {
  return { left: m.ll * left + m.rl * right, right: m.lr * left + m.rr * right };
}

describe('panMatrix — mono source (equal-power, the Web Audio mono law)', () => {
  it.each([
    [-1, 1, 0],
    [-0.5, Math.cos(Math.PI / 8), Math.sin(Math.PI / 8)],
    [0, SQRT_HALF, SQRT_HALF],
    [0.5, Math.cos((3 * Math.PI) / 8), Math.sin((3 * Math.PI) / 8)],
    [1, 0, 1],
  ])('pan %s puts a mono signal at L=%s R=%s', (p, left, right) => {
    // A mono signal reaches the matrix as L = R.
    const out = pan(panMatrix(p, 1), 1, 1);
    expect(out.left).toBeCloseTo(left, 10);
    expect(out.right).toBeCloseTo(right, 10);
  });

  it('keeps total power constant across the pan range', () => {
    for (const p of [-1, -0.7, -0.2, 0, 0.3, 0.9, 1]) {
      const out = pan(panMatrix(p, 1), 1, 1);
      expect(out.left ** 2 + out.right ** 2).toBeCloseTo(1, 10);
    }
  });

  it('never mixes channels, so a stereo effect on a mono track stays stereo', () => {
    // A left-only signal (e.g. from a stereo effect) must not leak right.
    const out = pan(panMatrix(0, 1), 1, 0);
    expect(out.left).toBeCloseTo(SQRT_HALF, 10);
    expect(out.right).toBe(0);
  });
});

describe('panMatrix — stereo source (the Web Audio stereo law)', () => {
  it('passes both channels at unity when centred', () => {
    const out = pan(panMatrix(0, 2), 0.3, -0.8);
    expect(out.left).toBeCloseTo(0.3, 10);
    expect(out.right).toBeCloseTo(-0.8, 10);
  });

  it('hard left folds the right channel into the left', () => {
    const out = pan(panMatrix(-1, 2), 0.3, 0.5);
    expect(out.left).toBeCloseTo(0.8, 10);
    expect(out.right).toBeCloseTo(0, 10);
  });

  it('hard right folds the left channel into the right', () => {
    const out = pan(panMatrix(1, 2), 0.3, 0.5);
    expect(out.left).toBeCloseTo(0, 10);
    expect(out.right).toBeCloseTo(0.8, 10);
  });

  it('half left: L + R·cos(π/4), R·sin(π/4)', () => {
    const out = pan(panMatrix(-0.5, 2), 1, 1);
    expect(out.left).toBeCloseTo(1 + SQRT_HALF, 10);
    expect(out.right).toBeCloseTo(SQRT_HALF, 10);
  });
});

describe('panMatrix input handling', () => {
  it('clamps out-of-range pan values', () => {
    expect(panMatrix(-3, 1)).toEqual(panMatrix(-1, 1));
    expect(panMatrix(7, 2)).toEqual(panMatrix(1, 2));
  });
});

describe('createTrackPanStage', () => {
  it('takes its input as explicit stereo so mono is upmixed and stereo passes through', () => {
    const stage = createTrackPanStage(0, 1);
    const upmix = stage.input as unknown as MockGain;

    expect(upmix.channelCount).toBe(2);
    expect(upmix.channelCountMode).toBe('explicit');
    expect(upmix.channelInterpretation).toBe('speakers');
    expect(stage.output).toBe(created.merges[0]);
  });

  it('wires a 2×2 matrix: each input channel to each output channel', () => {
    createTrackPanStage(0, 2);
    const split = created.splits[0] as { connect: ReturnType<typeof vi.fn> };
    const merge = created.merges[0];
    const [, ll, lr, rl, rr] = created.gains; // [upmix, ll, lr, rl, rr]

    expect(split.connect.mock.calls).toEqual([
      [ll, 0, 0],
      [lr, 0, 0],
      [rl, 1, 0],
      [rr, 1, 0],
    ]);
    expect(ll.connect).toHaveBeenCalledWith(merge, 0, 0);
    expect(rl.connect).toHaveBeenCalledWith(merge, 0, 0);
    expect(lr.connect).toHaveBeenCalledWith(merge, 0, 1);
    expect(rr.connect).toHaveBeenCalledWith(merge, 0, 1);
  });

  it('starts at the requested pan and follows setPan', () => {
    const stage = createTrackPanStage(-1, 1);
    const [, ll, lr, rl, rr] = created.gains;
    expect([ll, lr, rl, rr].map((g) => g.gain.value)).toEqual([1, 0, 0, expect.closeTo(0, 10)]);

    stage.setPan(1);

    expect(ll.gain.value).toBeCloseTo(0, 10);
    expect(rr.gain.value).toBeCloseTo(1, 10);
  });

  it('keeps using the law of the source it was built for', () => {
    const stage = createTrackPanStage(0, 2);
    const [, ll, lr, rl, rr] = created.gains;

    stage.setPan(-1);

    expect([ll, lr, rl, rr].map((g) => g.gain.value)).toEqual([
      1,
      0,
      expect.closeTo(1, 10),
      expect.closeTo(0, 10),
    ]);
  });

  it('dispose releases every node', () => {
    const stage = createTrackPanStage(0, 1);
    stage.dispose();

    for (const node of [...created.gains, ...created.splits, ...created.merges]) {
      expect((node as { dispose: ReturnType<typeof vi.fn> }).dispose).toHaveBeenCalledTimes(1);
    }
  });
});
