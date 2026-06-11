import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EffectsChainController } from '../effects/effects-chain-controller';
import type { EffectChainItem } from '../effects/types';

function mockNode(label: string) {
  return {
    label,
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1 },
  };
}

let nodeCounter = 0;

function mockAudioContext() {
  return {
    createGain: vi.fn(() => mockNode('gain-' + ++nodeCounter)),
  } as unknown as BaseAudioContext;
}

function makeItem(overrides: Partial<EffectChainItem> = {}): EffectChainItem {
  const input = mockNode('fx-in-' + ++nodeCounter);
  const output = mockNode('fx-out-' + ++nodeCounter);
  return {
    kind: 'native',
    type: 'test-effect',
    instance: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input: input as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      output: output as any,
      applyParams: vi.fn(),
      dispose: vi.fn(),
    },
    params: { amount: 1 },
    ...overrides,
  };
}

/** The series of connect() targets currently outgoing from a mock node — last call wins per rebuild. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lastConnectTarget(node: any): unknown {
  const calls = node.connect.mock.calls;
  return calls.length ? calls[calls.length - 1][0] : undefined;
}

beforeEach(() => {
  nodeCounter = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EffectsChainController', () => {
  it('empty chain passes input straight through to output', () => {
    const ctx = mockAudioContext();
    const chain = new EffectsChainController(ctx);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(lastConnectTarget(chain.input as any)).toBe(chain.output);
  });

  it('add wires input -> effect -> output', () => {
    const chain = new EffectsChainController(mockAudioContext());
    const item = makeItem();
    const id = chain.add(item);

    expect(typeof id).toBe('string');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(lastConnectTarget(chain.input as any)).toBe(item.instance.input);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(lastConnectTarget(item.instance.output as any)).toBe(chain.output);
  });

  it('second add appends in series and entries reflect order', () => {
    const chain = new EffectsChainController(mockAudioContext());
    const first = makeItem({ type: 'first' });
    const second = makeItem({ type: 'second' });
    chain.add(first);
    chain.add(second);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(lastConnectTarget(first.instance.output as any)).toBe(second.instance.input);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(lastConnectTarget(second.instance.output as any)).toBe(chain.output);
    expect(chain.entries.map((e) => e.type)).toEqual(['first', 'second']);
  });

  it('add at index 0 inserts before existing entries', () => {
    const chain = new EffectsChainController(mockAudioContext());
    chain.add(makeItem({ type: 'first' }));
    chain.add(makeItem({ type: 'inserted' }), 0);

    expect(chain.entries.map((e) => e.type)).toEqual(['inserted', 'first']);
  });

  it('move reorders the chain and rewires', () => {
    const chain = new EffectsChainController(mockAudioContext());
    const a = makeItem({ type: 'a' });
    const b = makeItem({ type: 'b' });
    chain.add(a);
    const idB = chain.add(b);

    chain.move(idB, 0);

    expect(chain.entries.map((e) => e.type)).toEqual(['b', 'a']);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(lastConnectTarget(b.instance.output as any)).toBe(a.instance.input);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(lastConnectTarget(a.instance.output as any)).toBe(chain.output);
  });

  it('setParams applies the delta without rebuilding the chain', () => {
    const chain = new EffectsChainController(mockAudioContext());
    const item = makeItem();
    const id = chain.add(item);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const connectCallsBefore = (chain.input as any).connect.mock.calls.length;

    chain.setParams(id, { amount: 0.5 });

    expect(item.instance.applyParams).toHaveBeenCalledWith({ amount: 0.5 });
    expect(chain.entries[0].params.amount).toBe(0.5);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((chain.input as any).connect.mock.calls.length).toBe(connectCallsBefore);
  });

  it('bypass on a wet effect zeroes wet and restores it, without rebuild', () => {
    const chain = new EffectsChainController(mockAudioContext());
    const item = makeItem({ params: { wet: 0.7 }, wetParam: 'wet' });
    const id = chain.add(item);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const connectCallsBefore = (chain.input as any).connect.mock.calls.length;

    chain.setBypassed(id, true);
    expect(item.instance.applyParams).toHaveBeenCalledWith({ wet: 0 });
    expect(chain.entries[0].bypassed).toBe(true);

    chain.setBypassed(id, false);
    expect(item.instance.applyParams).toHaveBeenCalledWith({ wet: 0.7 });
    expect(chain.entries[0].bypassed).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((chain.input as any).connect.mock.calls.length).toBe(connectCallsBefore);
  });

  it('bypass on a non-wet effect removes it from the series but keeps the instance', () => {
    const chain = new EffectsChainController(mockAudioContext());
    const a = makeItem({ type: 'a' });
    const b = makeItem({ type: 'b' });
    const idA = chain.add(a);
    chain.add(b);

    chain.setBypassed(idA, true);

    // a is out of the audio path: input goes straight to b
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(lastConnectTarget(chain.input as any)).toBe(b.instance.input);
    expect(a.instance.dispose).not.toHaveBeenCalled();
    // still listed, flagged bypassed, position preserved
    expect(chain.entries.map((e) => e.type)).toEqual(['a', 'b']);
    expect(chain.entries[0].bypassed).toBe(true);

    chain.setBypassed(idA, false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(lastConnectTarget(chain.input as any)).toBe(a.instance.input);
  });

  it('remove rewires around the entry and disposes the instance', () => {
    const chain = new EffectsChainController(mockAudioContext());
    const a = makeItem({ type: 'a' });
    const b = makeItem({ type: 'b' });
    const idA = chain.add(a);
    chain.add(b);

    chain.remove(idA);

    expect(chain.entries.map((e) => e.type)).toEqual(['b']);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(lastConnectTarget(chain.input as any)).toBe(b.instance.input);
    expect(a.instance.dispose).toHaveBeenCalledTimes(1);
  });

  it('entries returns defensive copies', () => {
    const chain = new EffectsChainController(mockAudioContext());
    chain.add(makeItem());

    const snapshot = chain.entries;
    snapshot[0].params.amount = 999;
    snapshot.pop();

    expect(chain.entries).toHaveLength(1);
    expect(chain.entries[0].params.amount).toBe(1);
  });

  it('operations on an unknown id warn and no-op', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const chain = new EffectsChainController(mockAudioContext());
    chain.add(makeItem());

    chain.remove('nope');
    chain.move('nope', 0);
    chain.setParams('nope', { x: 1 });
    chain.setBypassed('nope', true);

    expect(warn).toHaveBeenCalledTimes(4);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[waveform-playlist]'));
    expect(chain.entries).toHaveLength(1);
  });

  it('dispose disconnects the chain and disposes all instances', () => {
    const chain = new EffectsChainController(mockAudioContext());
    const a = makeItem();
    const b = makeItem();
    chain.add(a);
    chain.add(b);

    chain.dispose();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((chain.input as any).disconnect).toHaveBeenCalled();
    expect(a.instance.dispose).toHaveBeenCalledTimes(1);
    expect(b.instance.dispose).toHaveBeenCalledTimes(1);
    expect(chain.entries).toHaveLength(0);
  });
});
