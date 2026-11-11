import { describe, it, expect, vi, beforeEach } from 'vitest';

// The pan stage has its own unit tests in core (panStage.test.ts) and is
// verified against real audio in a browser. Here it is one opaque node, so
// the graph assertions below stay about the TRACK's wiring.
const panStages: Array<{
  input: unknown;
  output: unknown;
  args: [number, number];
  setPan: ReturnType<typeof vi.fn>;
  setSourceChannelCount: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('@waveform-playlist/core', () => ({
  createPanStage: vi.fn((_ctx: unknown, pan: number, sourceChannelCount: number) => {
    const node = createNode('pan');
    const stage = {
      input: node,
      output: node,
      args: [pan, sourceChannelCount] as [number, number],
      setPan: vi.fn(),
      setSourceChannelCount: vi.fn(),
      dispose: vi.fn(() => node.outputs.clear()),
    };
    panStages.push(stage);
    return stage;
  }),
}));

import { TrackNode } from '../audio/track-node';

/**
 * Mock nodes keep a live edge set, so tests assert the resulting GRAPH
 * (who feeds whom) rather than a call log — the signal order is the
 * contract here (#660: inserts sit BEFORE the fader and pan).
 */
interface MockNode {
  name: string;
  outputs: Set<MockNode>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  gain?: { value: number };
}

function createNode(name: string, extra: Partial<MockNode> = {}): MockNode {
  const node: MockNode = {
    name,
    outputs: new Set(),
    connect: vi.fn((target: MockNode) => {
      node.outputs.add(target);
    }),
    disconnect: vi.fn((target?: MockNode) => {
      if (target === undefined) {
        node.outputs.clear();
        return;
      }
      if (!node.outputs.has(target)) {
        // Mirrors Web Audio: disconnecting an edge that does not exist throws.
        throw new DOMException('not connected', 'InvalidAccessError');
      }
      node.outputs.delete(target);
    }),
    ...extra,
  };
  return node;
}

/** Every path from `from`, as "a>b>c" strings, following live edges. */
function paths(from: MockNode): string[] {
  if (from.outputs.size === 0) return [from.name];
  return [...from.outputs].flatMap((next) => paths(next).map((p) => from.name + '>' + p));
}

function mockAudioContext() {
  const gainNames = ['input', 'volume', 'mute'];
  let gains = 0;
  return {
    createGain: vi.fn(() =>
      createNode(gainNames[gains++] ?? 'gain' + gains, { gain: { value: 1 } })
    ),
    createStereoPanner: vi.fn(() => {
      throw new Error('TrackNode must not create a StereoPannerNode (#669)');
    }),
  } as unknown as AudioContext;
}

function asNode(node: unknown): MockNode {
  return node as MockNode;
}

function nodes(ctx: AudioContext) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gainResults = (ctx.createGain as any).mock.results.map((r: any) => r.value as MockNode);
  const stage = panStages[panStages.length - 1];
  const pan = stage.input as MockNode;
  const [input, volume, mute] = gainResults;
  return { input, volume, pan, mute, stage };
}

describe('TrackNode', () => {
  let ctx: AudioContext;
  const master = createNode('master');

  beforeEach(() => {
    ctx = mockAudioContext();
    master.outputs.clear();
    panStages.length = 0;
  });

  function build() {
    const track = new TrackNode('track-1', ctx);
    track.connectOutput(master as unknown as AudioNode);
    return { track, ...nodes(ctx) };
  }

  it('wires input → volume → pan → mute → output', () => {
    const { track, input } = build();

    expect(track.id).toBe('track-1');
    expect(paths(input)).toEqual(['input>volume>pan>mute>master']);
  });

  it('clip sources connect to the pre-fader input, not the volume node', () => {
    const { track, input, volume } = build();

    expect(asNode(track.input)).toBe(input);
    expect(asNode(track.input)).not.toBe(volume);
  });

  it('setVolume drives the fader, leaving the input at unity', () => {
    const { track, input, volume } = build();

    track.setVolume(0.5);

    expect(volume.gain!.value).toBe(0.5);
    expect(input.gain!.value).toBe(1);
  });

  it('setPan updates the pan stage', () => {
    const { track, stage } = build();
    track.setPan(-0.5);
    expect(stage.setPan).toHaveBeenCalledWith(-0.5);
  });

  it('builds a mono-law pan stage by default, centred', () => {
    const { stage } = build();
    expect(stage.args).toEqual([0, 1]);
  });

  it('builds the pan stage for the given source channel count', () => {
    new TrackNode('track-2', ctx, 2);
    expect(panStages[panStages.length - 1].args).toEqual([0, 2]);
  });

  it('setSourceChannelCount switches the pan law', () => {
    const { track, stage } = build();
    track.setSourceChannelCount(2);
    expect(stage.setSourceChannelCount).toHaveBeenCalledWith(2);
  });

  it('setMute toggles the mute gain', () => {
    const { track, mute } = build();
    track.setMute(true);
    expect(mute.gain!.value).toBe(0);
    track.setMute(false);
    expect(mute.gain!.value).toBe(1);
  });

  describe('effects insert (#660)', () => {
    function chain() {
      const fxIn = createNode('fxIn');
      const fxOut = createNode('fxOut');
      fxIn.outputs.add(fxOut); // the chain's own internal edge
      return { fxIn, fxOut };
    }

    it('inserts the chain BEFORE volume and pan', () => {
      const { track, input } = build();
      const { fxIn, fxOut } = chain();

      track.connectEffects(fxIn as unknown as AudioNode, fxOut as unknown as AudioNode);

      // Pre-fader: the fader, pan and mute all come after the chain, and
      // nothing bypasses it.
      expect(paths(input)).toEqual(['input>fxIn>fxOut>volume>pan>mute>master']);
    });

    it('accepts a single node as both input and output', () => {
      const { track, input } = build();
      const fx = createNode('fx');

      track.connectEffects(fx as unknown as AudioNode, fx as unknown as AudioNode);

      expect(paths(input)).toEqual(['input>fx>volume>pan>mute>master']);
    });

    it('disconnectEffects restores the direct path and releases the chain', () => {
      const { track, input } = build();
      const { fxIn, fxOut } = chain();
      track.connectEffects(fxIn as unknown as AudioNode, fxOut as unknown as AudioNode);

      track.disconnectEffects();

      expect(paths(input)).toEqual(['input>volume>pan>mute>master']);
      // The chain no longer feeds the track.
      expect(fxOut.outputs.size).toBe(0);
    });

    it('connecting a second chain replaces the first cleanly', () => {
      const { track, input } = build();
      const first = chain();
      const second = { fxIn: createNode('fxIn2'), fxOut: createNode('fxOut2') };
      second.fxIn.outputs.add(second.fxOut);
      track.connectEffects(first.fxIn as unknown as AudioNode, first.fxOut as unknown as AudioNode);

      track.connectEffects(
        second.fxIn as unknown as AudioNode,
        second.fxOut as unknown as AudioNode
      );

      expect(paths(input)).toEqual(['input>fxIn2>fxOut2>volume>pan>mute>master']);
      expect(first.fxOut.outputs.size).toBe(0);
    });

    it('only removes the chain return edge — other consumers of the chain output survive', () => {
      const { track } = build();
      const { fxIn, fxOut } = chain();
      const tap = createNode('tap');
      fxOut.outputs.add(tap);
      track.connectEffects(fxIn as unknown as AudioNode, fxOut as unknown as AudioNode);

      track.disconnectEffects();

      expect([...fxOut.outputs]).toEqual([tap]);
    });

    it('survives a chain whose output was already disconnected externally', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { track, input } = build();
      const { fxIn, fxOut } = chain();
      track.connectEffects(fxIn as unknown as AudioNode, fxOut as unknown as AudioNode);
      fxOut.outputs.clear(); // consumer disposed its chain first

      expect(() => track.disconnectEffects()).not.toThrow();

      expect(paths(input)).toEqual(['input>volume>pan>mute>master']);
      warn.mockRestore();
    });

    it('disconnectEffects without a chain is a no-op', () => {
      const { track, input } = build();
      track.disconnectEffects();
      expect(paths(input)).toEqual(['input>volume>pan>mute>master']);
    });

    it('the track mute still silences a track with effects (mute is after the chain)', () => {
      const { track, input, mute } = build();
      const { fxIn, fxOut } = chain();
      track.connectEffects(fxIn as unknown as AudioNode, fxOut as unknown as AudioNode);

      track.setMute(true);

      expect(mute.gain!.value).toBe(0);
      expect(paths(input)[0].endsWith('mute>master')).toBe(true);
    });
  });

  it('dispose disconnects all nodes', () => {
    const { track, input, volume, pan, mute, stage } = build();
    track.dispose();

    expect(stage.dispose).toHaveBeenCalledTimes(1);
    for (const node of [input, volume, pan, mute]) {
      expect(node.outputs.size).toBe(0);
    }
  });

  it('dispose releases a connected chain return edge', () => {
    const { track } = build();
    const fxIn = createNode('fxIn');
    const fxOut = createNode('fxOut');
    track.connectEffects(fxIn as unknown as AudioNode, fxOut as unknown as AudioNode);

    track.dispose();

    expect(fxOut.outputs.size).toBe(0);
  });
});
