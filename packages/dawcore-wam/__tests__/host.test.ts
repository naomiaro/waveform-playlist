import { describe, it, expect, vi, beforeEach } from 'vitest';

const { initializeWamHost } = vi.hoisted(() => ({
  initializeWamHost: vi.fn(),
}));

vi.mock('@webaudiomodules/sdk', () => ({
  initializeWamHost,
}));

import { ensureWamHost, _resetWamHostCacheForTests } from '../src/host';

let groupCounter: number;

function mockRealtimeContext(state: AudioContextState = 'running'): BaseAudioContext {
  return {
    state,
    sampleRate: 48000,
    resume: vi.fn(),
  } as unknown as BaseAudioContext;
}

function mockOfflineContext(): BaseAudioContext {
  return {
    state: 'suspended',
    sampleRate: 48000,
    startRendering: vi.fn(),
  } as unknown as BaseAudioContext;
}

beforeEach(() => {
  groupCounter = 0;
  initializeWamHost.mockReset();
  initializeWamHost.mockImplementation(async () => {
    groupCounter += 1;
    return ['group-' + groupCounter, 'key-' + groupCounter];
  });
  _resetWamHostCacheForTests();
});

describe('ensureWamHost', () => {
  it('initializes the host and returns hostGroupId and hostGroupKey', async () => {
    const ctx = mockRealtimeContext();
    const result = await ensureWamHost(ctx);

    expect(initializeWamHost).toHaveBeenCalledTimes(1);
    expect(initializeWamHost).toHaveBeenCalledWith(ctx);
    expect(result).toEqual({ hostGroupId: 'group-1', hostGroupKey: 'key-1' });
  });

  it('is idempotent per context — second call returns the same group without re-init', async () => {
    const ctx = mockRealtimeContext();
    const first = await ensureWamHost(ctx);
    const second = await ensureWamHost(ctx);

    expect(initializeWamHost).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('concurrent callers share one in-flight initialization', async () => {
    const ctx = mockRealtimeContext();
    const [a, b] = await Promise.all([ensureWamHost(ctx), ensureWamHost(ctx)]);

    expect(initializeWamHost).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it('distinct contexts get distinct host groups', async () => {
    const a = await ensureWamHost(mockRealtimeContext());
    const b = await ensureWamHost(mockRealtimeContext());

    expect(initializeWamHost).toHaveBeenCalledTimes(2);
    expect(a.hostGroupId).not.toBe(b.hostGroupId);
  });

  it('rejects on a suspended realtime context with a resume hint', async () => {
    const ctx = mockRealtimeContext('suspended');

    await expect(ensureWamHost(ctx)).rejects.toThrow(
      /\[waveform-playlist\].*resume/i
    );
    expect(initializeWamHost).not.toHaveBeenCalled();
  });

  it('rejects on a closed context', async () => {
    const ctx = mockRealtimeContext('closed');

    await expect(ensureWamHost(ctx)).rejects.toThrow(/\[waveform-playlist\]/);
    expect(initializeWamHost).not.toHaveBeenCalled();
  });

  it('allows a suspended OfflineAudioContext (offline rendering inits before startRendering)', async () => {
    const ctx = mockOfflineContext();
    const result = await ensureWamHost(ctx);

    expect(initializeWamHost).toHaveBeenCalledTimes(1);
    expect(result.hostGroupId).toBe('group-1');
  });

  it('evicts a failed initialization so a retry re-initializes', async () => {
    const ctx = mockRealtimeContext();
    initializeWamHost.mockRejectedValueOnce(new Error('worklet load failed'));

    await expect(ensureWamHost(ctx)).rejects.toThrow('worklet load failed');

    const result = await ensureWamHost(ctx);
    expect(initializeWamHost).toHaveBeenCalledTimes(2);
    expect(result.hostGroupId).toBe('group-1');
  });
});
