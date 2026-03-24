import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrackNode } from '../audio/track-node';

function createMockGainNode() {
  return {
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function createMockPannerNode() {
  return {
    pan: { value: 0 },
    channelCount: 1,
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function mockAudioContext() {
  return {
    createGain: vi.fn(() => createMockGainNode()),
    createStereoPanner: vi.fn(() => createMockPannerNode()),
  } as unknown as AudioContext;
}

describe('TrackNode', () => {
  let ctx: AudioContext;

  beforeEach(() => {
    ctx = mockAudioContext();
  });

  it('creates signal chain on construction', () => {
    const node = new TrackNode('track-1', ctx);
    // Should create 2 gain nodes (volume + mute) and 1 panner
    expect(ctx.createGain).toHaveBeenCalledTimes(2);
    expect(ctx.createStereoPanner).toHaveBeenCalledTimes(1);
    expect(node.id).toBe('track-1');
  });

  it('setVolume updates gain value', () => {
    const node = new TrackNode('track-1', ctx);
    node.setVolume(0.5);
    expect(node.input.gain.value).toBe(0.5);
  });

  it('setPan updates panner value', () => {
    const node = new TrackNode('track-1', ctx);
    node.setPan(-0.5);
    // The panner's pan value should be set
    const pannerCalls = (ctx.createStereoPanner as any).mock.results;
    const panner = pannerCalls[0].value;
    expect(panner.pan.value).toBe(-0.5);
  });

  it('setMute sets mute gain to 0 and 1', () => {
    const node = new TrackNode('track-1', ctx);
    node.setMute(true);
    // The second gain node (mute) should have gain 0
    const gainCalls = (ctx.createGain as any).mock.results;
    const muteNode = gainCalls[1].value;
    expect(muteNode.gain.value).toBe(0);

    node.setMute(false);
    expect(muteNode.gain.value).toBe(1);
  });

  it('connectEffects reroutes signal through effects', () => {
    const node = new TrackNode('track-1', ctx);
    const effectsInput = { connect: vi.fn(), disconnect: vi.fn() } as any;
    node.connectEffects(effectsInput);

    // muteNode should be disconnected from output and connected to effects
    const gainCalls = (ctx.createGain as any).mock.results;
    const muteNode = gainCalls[1].value;
    expect(muteNode.disconnect).toHaveBeenCalled();
    expect(muteNode.connect).toHaveBeenCalledWith(effectsInput);
  });

  it('disconnectEffects restores routing to destination', () => {
    const node = new TrackNode('track-1', ctx);
    const destination = { connect: vi.fn(), disconnect: vi.fn() } as any;
    node.connectOutput(destination);

    const effectsInput = { connect: vi.fn(), disconnect: vi.fn() } as any;
    node.connectEffects(effectsInput);
    node.disconnectEffects();

    const gainCalls = (ctx.createGain as any).mock.results;
    const muteNode = gainCalls[1].value;
    // muteNode should be reconnected to destination (connectOutput + effects + restore)
    expect(muteNode.connect).toHaveBeenCalledTimes(3);
    // Last connect call should be to the destination, not to muteNode itself
    const lastConnectCall = muteNode.connect.mock.calls[2][0];
    expect(lastConnectCall).toBe(destination);
  });

  it('dispose disconnects all nodes', () => {
    const node = new TrackNode('track-1', ctx);
    node.dispose();

    const gainCalls = (ctx.createGain as any).mock.results;
    const pannerCalls = (ctx.createStereoPanner as any).mock.results;
    expect(gainCalls[0].value.disconnect).toHaveBeenCalled();
    expect(gainCalls[1].value.disconnect).toHaveBeenCalled();
    expect(pannerCalls[0].value.disconnect).toHaveBeenCalled();
  });
});
