import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MasterNode } from '../audio/master-node';

function createMockGainNode() {
  return {
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function mockAudioContext() {
  return {
    createGain: vi.fn(() => createMockGainNode()),
  } as unknown as AudioContext;
}

function getGainNode(ctx: AudioContext) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ctx.createGain as any).mock.results[0].value;
}

function createMockNode() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { connect: vi.fn(), disconnect: vi.fn() } as any;
}

describe('MasterNode', () => {
  let ctx: AudioContext;

  beforeEach(() => {
    ctx = mockAudioContext();
  });

  it('connectOutput routes gain to destination', () => {
    const master = new MasterNode(ctx);
    const destination = createMockNode();
    master.connectOutput(destination);

    const gain = getGainNode(ctx);
    expect(gain.connect).toHaveBeenCalledWith(destination);
  });

  it('connectEffects reroutes output through the effects input', () => {
    const master = new MasterNode(ctx);
    const destination = createMockNode();
    master.connectOutput(destination);

    const effectsInput = createMockNode();
    master.connectEffects(effectsInput);

    const gain = getGainNode(ctx);
    // Targeted disconnect — only the destination edge, so parallel taps
    // (analyzers, recorders) on the master output survive.
    expect(gain.disconnect).toHaveBeenCalledWith(destination);
    expect(gain.disconnect).not.toHaveBeenCalledWith();
    expect(gain.connect).toHaveBeenCalledWith(effectsInput);
  });

  it('connectEffects twice replaces the first chain cleanly', () => {
    const master = new MasterNode(ctx);
    const destination = createMockNode();
    master.connectOutput(destination);

    const firstChain = createMockNode();
    const secondChain = createMockNode();
    master.connectEffects(firstChain);
    master.connectEffects(secondChain);

    const gain = getGainNode(ctx);
    // The first chain's edge must be severed before the second connects.
    expect(gain.disconnect).toHaveBeenCalledWith(firstChain);
    expect(gain.connect).toHaveBeenCalledWith(secondChain);
    // No duplicate connection to the first chain remains: connect order is
    // destination, firstChain, secondChain.
    expect(gain.connect.mock.calls.map((c: unknown[]) => c[0])).toEqual([
      destination,
      firstChain,
      secondChain,
    ]);
  });

  it('disconnectEffects restores direct routing to destination', () => {
    const master = new MasterNode(ctx);
    const destination = createMockNode();
    master.connectOutput(destination);

    const effectsInput = createMockNode();
    master.connectEffects(effectsInput);
    master.disconnectEffects();

    const gain = getGainNode(ctx);
    expect(gain.disconnect).toHaveBeenCalledWith(effectsInput);
    const lastConnect = gain.connect.mock.calls.at(-1)[0];
    expect(lastConnect).toBe(destination);
  });

  it('disconnectEffects without a connected chain is a no-op', () => {
    const master = new MasterNode(ctx);
    const destination = createMockNode();
    master.connectOutput(destination);

    master.disconnectEffects();

    const gain = getGainNode(ctx);
    // Only the initial connectOutput call — no disconnect churn.
    expect(gain.disconnect).not.toHaveBeenCalled();
    expect(gain.connect).toHaveBeenCalledTimes(1);
  });

  it('dispose while effects connected disconnects everything', () => {
    const master = new MasterNode(ctx);
    const destination = createMockNode();
    master.connectOutput(destination);
    master.connectEffects(createMockNode());

    master.dispose();

    const gain = getGainNode(ctx);
    // Blanket disconnect on dispose tears down all edges.
    expect(gain.disconnect).toHaveBeenCalledWith();
  });
});
