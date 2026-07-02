// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { state, MockOfflineContext } = vi.hoisted(() => {
  const state = {
    ctorArgs: [] as unknown[][],
    render: vi.fn(),
    getContext: vi.fn(),
    setContext: vi.fn(),
    isNative: vi.fn(() => true),
  };
  class MockOfflineContext {
    render = state.render;
    constructor(...args: unknown[]) {
      state.ctorArgs.push(args);
    }
  }
  return { state, MockOfflineContext };
});

vi.mock('tone', () => ({
  getContext: (...a: unknown[]) => state.getContext(...a),
  setContext: (...a: unknown[]) => state.setContext(...a),
  OfflineContext: MockOfflineContext,
}));

vi.mock('@waveform-playlist/playout', () => ({
  isNativeGlobalContext: () => state.isNative(),
}));

import { renderToneOffline } from '../utils/renderToneOffline';

class FakeNativeOfflineAudioContext {
  options: unknown;
  constructor(options: unknown) {
    this.options = options;
  }
}

const previousContext = { id: 'previous' };
const renderedAudioBuffer = { length: 144000 };

describe('renderToneOffline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.ctorArgs.length = 0;
    state.isNative.mockReturnValue(true);
    state.getContext.mockReturnValue(previousContext);
    state.render.mockResolvedValue({ get: () => renderedAudioBuffer });
    vi.stubGlobal('OfflineAudioContext', FakeNativeOfflineAudioContext);
  });

  it('native mode: wraps a native OfflineAudioContext with the right options', async () => {
    const result = await renderToneOffline(() => undefined, 3, 2, 48000);
    expect(state.ctorArgs).toHaveLength(1);
    const [wrapped] = state.ctorArgs[0];
    expect(wrapped).toBeInstanceOf(FakeNativeOfflineAudioContext);
    expect((wrapped as FakeNativeOfflineAudioContext).options).toEqual({
      numberOfChannels: 2,
      length: 144000,
      sampleRate: 48000,
    });
    expect(result).toBe(renderedAudioBuffer);
  });

  it('standardized mode: constructs OfflineContext(channels, duration, sampleRate)', async () => {
    state.isNative.mockReturnValue(false);
    await renderToneOffline(() => undefined, 3, 2, 48000);
    expect(state.ctorArgs[0]).toEqual([2, 3, 48000]);
  });

  it('sets the offline context for the build and restores the previous one before rendering', async () => {
    const build = vi.fn();
    await renderToneOffline(build, 1, 2, 48000);
    expect(state.setContext).toHaveBeenCalledTimes(2);
    expect(state.setContext.mock.calls[0][0]).toBeInstanceOf(MockOfflineContext);
    expect(state.setContext.mock.calls[1][0]).toBe(previousContext);
    // build runs between the two setContext calls; render runs after restore
    expect(build.mock.invocationCallOrder[0]).toBeGreaterThan(
      state.setContext.mock.invocationCallOrder[0]
    );
    expect(state.render.mock.invocationCallOrder[0]).toBeGreaterThan(
      state.setContext.mock.invocationCallOrder[1]
    );
  });

  it('restores the previous context when the build throws (upstream Tone.Offline leaks here)', async () => {
    const boom = new Error('graph build failed');
    await expect(
      renderToneOffline(
        () => {
          throw boom;
        },
        1,
        2,
        48000
      )
    ).rejects.toThrow('graph build failed');
    expect(state.setContext).toHaveBeenLastCalledWith(previousContext);
    expect(state.render).not.toHaveBeenCalled();
  });

  it('throws when the rendered ToneAudioBuffer is empty', async () => {
    state.render.mockResolvedValue({ get: () => null });
    await expect(renderToneOffline(() => undefined, 1, 2, 48000)).rejects.toThrow(
      /produced no audio buffer/
    );
  });

  it('serializes concurrent renders — the global context is never restored to a spent offline context', async () => {
    // Stateful context tracking: getContext returns whatever setContext last set.
    let current: unknown = previousContext;
    state.getContext.mockImplementation(() => current);
    state.setContext.mockImplementation((ctx: unknown) => {
      current = ctx;
    });
    // Slow builds so the two renders would overlap without serialization.
    const slowBuild = () => new Promise<void>((r) => setTimeout(r, 20));
    const [a, b] = await Promise.all([
      renderToneOffline(slowBuild, 1, 2, 48000),
      renderToneOffline(slowBuild, 1, 2, 48000),
    ]);
    expect(a).toBe(renderedAudioBuffer);
    expect(b).toBe(renderedAudioBuffer);
    // After both complete, the global context must be the ORIGINAL previous
    // context — under interleaving, the last restore leaves an offline context.
    expect(current).toBe(previousContext);
    expect(current).not.toBeInstanceOf(MockOfflineContext);
  });
});
