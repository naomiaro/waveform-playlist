import { describe, it, expect, vi } from 'vitest';
import { createPanStage, panMatrix, PAN_LAW_RAMP_SECONDS, type PanStageContext } from '../panStage';

const SQRT_HALF = Math.SQRT1_2;

interface MockParam {
  value: number;
  cancelScheduledValues: ReturnType<typeof vi.fn>;
  setValueAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
}

/** A gain param whose ramp is over at once: `value` is where the ramp ends. */
function mockParam(): MockParam {
  const param: MockParam = {
    value: 1,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn((value: number) => {
      param.value = value;
    }),
  };
  return param;
}

interface MockNode {
  kind: 'gain' | 'split' | 'merge';
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  gain?: MockParam;
  channelCount?: number;
  channelCountMode?: string;
  channelInterpretation?: string;
}

function mockContext() {
  const created: { gains: MockNode[]; splits: MockNode[]; merges: MockNode[] } = {
    gains: [],
    splits: [],
    merges: [],
  };
  const make = (kind: MockNode['kind'], extra: Partial<MockNode> = {}): MockNode => ({
    kind,
    connect: vi.fn(),
    disconnect: vi.fn(),
    ...extra,
  });
  const context = {
    currentTime: 0,
    createGain: vi.fn(() => {
      const node = make('gain', { gain: mockParam() });
      created.gains.push(node);
      return node;
    }),
    createChannelSplitter: vi.fn(() => {
      const node = make('split');
      created.splits.push(node);
      return node;
    }),
    createChannelMerger: vi.fn(() => {
      const node = make('merge');
      created.merges.push(node);
      return node;
    }),
  };
  return { context: context as unknown as PanStageContext, raw: context, created };
}

/** Apply a pan matrix to one stereo frame. */
function pan(m: ReturnType<typeof panMatrix>, left: number, right: number) {
  return { left: m.ll * left + m.rl * right, right: m.lr * left + m.rr * right };
}

function gainValues(created: { gains: MockNode[] }) {
  const [, ll, lr, rl, rr] = created.gains; // [upmix, ll, lr, rl, rr]
  return [ll, lr, rl, rr].map((g) => g.gain!.value);
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
    const out = pan(panMatrix(p, 'mono'), 1, 1);
    expect(out.left).toBeCloseTo(left, 10);
    expect(out.right).toBeCloseTo(right, 10);
  });

  it('keeps total power constant across the pan range', () => {
    for (const p of [-1, -0.7, -0.2, 0, 0.3, 0.9, 1]) {
      const out = pan(panMatrix(p, 'mono'), 1, 1);
      expect(out.left ** 2 + out.right ** 2).toBeCloseTo(1, 10);
    }
  });

  it('never mixes channels, so a stereo effect on a mono track stays stereo', () => {
    // A left-only signal (e.g. from a stereo effect) must not leak right.
    const out = pan(panMatrix(0, 'mono'), 1, 0);
    expect(out.left).toBeCloseTo(SQRT_HALF, 10);
    expect(out.right).toBe(0);
  });
});

describe('panMatrix — stereo source (the Web Audio stereo law)', () => {
  it('passes both channels at unity when centred', () => {
    const out = pan(panMatrix(0, 'stereo'), 0.3, -0.8);
    expect(out.left).toBeCloseTo(0.3, 10);
    expect(out.right).toBeCloseTo(-0.8, 10);
  });

  it('hard left folds the right channel into the left', () => {
    const out = pan(panMatrix(-1, 'stereo'), 0.3, 0.5);
    expect(out.left).toBeCloseTo(0.8, 10);
    expect(out.right).toBeCloseTo(0, 10);
  });

  it('hard right folds the left channel into the right', () => {
    const out = pan(panMatrix(1, 'stereo'), 0.3, 0.5);
    expect(out.left).toBeCloseTo(0, 10);
    expect(out.right).toBeCloseTo(0.8, 10);
  });

  it('half left: L + R·cos(π/4), R·sin(π/4)', () => {
    const out = pan(panMatrix(-0.5, 'stereo'), 1, 1);
    expect(out.left).toBeCloseTo(1 + SQRT_HALF, 10);
    expect(out.right).toBeCloseTo(SQRT_HALF, 10);
  });
});

describe('panMatrix input handling', () => {
  it('clamps out-of-range pan values', () => {
    expect(panMatrix(-3, 'mono')).toEqual(panMatrix(-1, 'mono'));
    expect(panMatrix(7, 'stereo')).toEqual(panMatrix(1, 'stereo'));
  });

  it('treats a non-finite pan as centre', () => {
    expect(panMatrix(Number.NaN, 'mono')).toEqual(panMatrix(0, 'mono'));
    expect(panMatrix(Number.NaN, 'stereo')).toEqual(panMatrix(0, 'stereo'));
  });
});

describe('createPanStage', () => {
  it('uses only gain, splitter and merger nodes — never a StereoPannerNode', () => {
    const { context, raw } = mockContext();
    createPanStage(context, 0, 'mono');

    expect(raw.createGain).toHaveBeenCalledTimes(5);
    expect(raw.createChannelSplitter).toHaveBeenCalledWith(2);
    expect(raw.createChannelMerger).toHaveBeenCalledWith(2);
  });

  it('takes its input as explicit stereo so mono is upmixed and stereo passes through', () => {
    const { context, created } = mockContext();
    const stage = createPanStage(context, 0, 'mono');
    const upmix = stage.input as unknown as MockNode;

    expect(upmix).toBe(created.gains[0]);
    expect(upmix.channelCount).toBe(2);
    expect(upmix.channelCountMode).toBe('explicit');
    expect(upmix.channelInterpretation).toBe('speakers');
    expect(upmix.connect).toHaveBeenCalledWith(created.splits[0]);
    expect(stage.output).toBe(created.merges[0]);
  });

  it('wires a 2×2 matrix: each input channel to each output channel', () => {
    const { context, created } = mockContext();
    createPanStage(context, 0, 'stereo');
    const split = created.splits[0];
    const merge = created.merges[0];
    const [, ll, lr, rl, rr] = created.gains;

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
    const { context, created } = mockContext();
    const stage = createPanStage(context, -1, 'mono');
    expect(gainValues(created)).toEqual([1, 0, 0, expect.closeTo(0, 10)]);

    stage.setPan(1);

    expect(gainValues(created)).toEqual([expect.closeTo(0, 10), 0, 0, expect.closeTo(1, 10)]);
  });

  it('keeps using the law of the source it was built for', () => {
    const { context, created } = mockContext();
    const stage = createPanStage(context, 0, 'stereo');

    stage.setPan(-1);

    expect(gainValues(created)).toEqual([1, 0, expect.closeTo(1, 10), expect.closeTo(0, 10)]);
  });

  it('setPanLaw switches the law at the current pan', () => {
    const { context, created } = mockContext();
    const stage = createPanStage(context, 0, 'mono');
    expect(gainValues(created)).toEqual([
      expect.closeTo(SQRT_HALF, 10),
      0,
      0,
      expect.closeTo(SQRT_HALF, 10),
    ]);

    stage.setPanLaw('stereo');
    expect(gainValues(created)).toEqual([1, 0, expect.closeTo(0, 10), 1]);

    // The pan set under one law carries over to the other.
    stage.setPan(-1);
    stage.setPanLaw('mono');
    expect(gainValues(created)).toEqual([1, 0, 0, expect.closeTo(0, 10)]);
  });

  it('a law switch ramps each gain from where it is to the new matrix over 10 ms', () => {
    const { context, raw, created } = mockContext();
    const stage = createPanStage(context, 0, 'mono');
    const [, ll, lr, rl, rr] = created.gains.map((g) => g.gain!);
    raw.currentTime = 2;

    stage.setPanLaw('stereo');

    const target = panMatrix(0, 'stereo');
    expect(PAN_LAW_RAMP_SECONDS).toBe(0.01);
    expect(ll.setValueAtTime).toHaveBeenCalledWith(expect.closeTo(SQRT_HALF, 10), 2);
    expect(ll.linearRampToValueAtTime).toHaveBeenCalledWith(target.ll, 2.01);
    expect(lr.linearRampToValueAtTime).toHaveBeenCalledWith(target.lr, 2.01);
    expect(rl.linearRampToValueAtTime).toHaveBeenCalledWith(target.rl, 2.01);
    expect(rr.linearRampToValueAtTime).toHaveBeenCalledWith(target.rr, 2.01);
  });

  it('the law the stage already has schedules nothing', () => {
    const { context, created } = mockContext();
    const stage = createPanStage(context, 0.3, 'mono');

    stage.setPanLaw('mono');

    for (const node of created.gains.slice(1)) {
      expect(node.gain!.linearRampToValueAtTime).not.toHaveBeenCalled();
      expect(node.gain!.setValueAtTime).not.toHaveBeenCalled();
    }
  });

  it('building a stage and moving the pan schedule nothing', () => {
    const { context, created } = mockContext();
    const stage = createPanStage(context, 0, 'stereo');

    stage.setPan(0.5);

    for (const node of created.gains.slice(1)) {
      expect(node.gain!.linearRampToValueAtTime).not.toHaveBeenCalled();
      expect(node.gain!.cancelScheduledValues).not.toHaveBeenCalled();
    }
  });

  it('a pan move after a switch cancels the ramp and lands on the new law', () => {
    const { context, raw, created } = mockContext();
    const stage = createPanStage(context, 0, 'mono');
    const rl = created.gains[3].gain!;
    raw.currentTime = 5;
    stage.setPanLaw('stereo');

    stage.setPan(-1);

    expect(rl.cancelScheduledValues).toHaveBeenLastCalledWith(5);
    // Cancelled before the value was written, so the ramp cannot override it.
    expect(rl.cancelScheduledValues.mock.invocationCallOrder.slice(-1)[0]).toBeGreaterThan(
      rl.linearRampToValueAtTime.mock.invocationCallOrder[0]
    );
    expect(gainValues(created)).toEqual([1, 0, expect.closeTo(1, 10), expect.closeTo(0, 10)]);
  });

  it('a second switch during a ramp starts from the value the gain has now', () => {
    const { context, raw, created } = mockContext();
    const stage = createPanStage(context, 0, 'mono');
    const ll = created.gains[1].gain!;
    raw.currentTime = 1;
    stage.setPanLaw('stereo');
    raw.currentTime = 1.004;

    stage.setPanLaw('mono');

    expect(ll.cancelScheduledValues).toHaveBeenLastCalledWith(1.004);
    // From where the gain is (this mock's ramp is over at once: the stereo law's 1), not from the old matrix.
    expect(ll.setValueAtTime).toHaveBeenLastCalledWith(1, 1.004);
    expect(ll.linearRampToValueAtTime).toHaveBeenLastCalledWith(
      expect.closeTo(SQRT_HALF, 10),
      1.014
    );
  });

  it('dispose disconnects every node', () => {
    const { context, created } = mockContext();
    const stage = createPanStage(context, 0, 'mono');
    stage.dispose();

    for (const node of [...created.gains, ...created.splits, ...created.merges]) {
      expect(node.disconnect).toHaveBeenCalledTimes(1);
    }
  });

  it('dispose keeps going when a node refuses to disconnect', () => {
    const { context, created } = mockContext();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stage = createPanStage(context, 0, 'mono');
    created.gains[0].disconnect.mockImplementation(() => {
      throw new Error('boom');
    });

    expect(() => stage.dispose()).not.toThrow();
    expect(created.merges[0].disconnect).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
