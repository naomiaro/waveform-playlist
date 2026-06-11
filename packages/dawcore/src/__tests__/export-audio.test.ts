import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportAudioImpl, type ExportAudioHost } from '../interactions/export-audio';
import type { SerializedEffectEntry } from '../effects/types';

const { ensureWamHost, createWamInstance } = vi.hoisted(() => ({
  ensureWamHost: vi.fn(),
  createWamInstance: vi.fn(),
}));

vi.mock('@dawcore/wam', () => ({ ensureWamHost, createWamInstance }));

function mockParam(value = 0) {
  return { value };
}

function mockNode(extra: Record<string, unknown> = {}) {
  return { connect: vi.fn(), disconnect: vi.fn(), ...extra };
}

const offlineInstances: MockOfflineContext[] = [];

class MockOfflineContext {
  options: { numberOfChannels: number; length: number; sampleRate: number };
  sampleRate: number;
  destination = mockNode();
  renderedBuffer = { duration: 1 } as unknown as AudioBuffer;
  sources: Array<ReturnType<typeof mockNode> & { start: ReturnType<typeof vi.fn> }> = [];
  gains: Array<ReturnType<typeof mockNode> & { gain: { value: number } }> = [];
  startRendering = vi.fn(async () => this.renderedBuffer);

  constructor(options: { numberOfChannels: number; length: number; sampleRate: number }) {
    this.options = options;
    this.sampleRate = options.sampleRate;
    offlineInstances.push(this);
  }

  createGain() {
    const node = mockNode({ gain: mockParam(1) });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.gains.push(node as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return node as any;
  }
  createStereoPanner() {
    return mockNode({ pan: mockParam(0) });
  }
  createDynamicsCompressor() {
    return mockNode({
      threshold: mockParam(-24),
      knee: mockParam(30),
      ratio: mockParam(12),
      attack: mockParam(0.003),
      release: mockParam(0.25),
    });
  }
  createDelay() {
    return mockNode({ delayTime: mockParam(0) });
  }
  createBiquadFilter() {
    return mockNode({ type: 'lowpass', frequency: mockParam(350), Q: mockParam(1) });
  }
  createBufferSource() {
    const node = mockNode({ buffer: null, start: vi.fn() });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.sources.push(node as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return node as any;
  }
}

function makeBuffer(): AudioBuffer {
  return { duration: 4, sampleRate: 48000 } as unknown as AudioBuffer;
}

function makeClip(overrides: Record<string, unknown> = {}) {
  return {
    id: 'clip-1',
    startSample: 48000, // 1s
    durationSamples: 96000, // 2s
    offsetSamples: 24000, // 0.5s into the file
    sampleRate: 48000,
    gain: 0.5,
    audioBuffer: makeBuffer(),
    ...overrides,
  };
}

function makeHost(overrides: Partial<ExportAudioHost> = {}): ExportAudioHost {
  return {
    effectiveSampleRate: 48000,
    duration: 4,
    tracks: [
      {
        id: 'track-1',
        volume: 0.8,
        pan: 0,
        muted: false,
        soloed: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clips: [makeClip() as any],
      },
    ],
    getMasterEffectsState: vi.fn(async () => [] as SerializedEffectEntry[]),
    getTrackEffectsState: vi.fn(async () => [] as SerializedEffectEntry[]),
    ...overrides,
  };
}

beforeEach(() => {
  offlineInstances.length = 0;
  ensureWamHost.mockReset().mockResolvedValue({ hostGroupId: 'off-group', hostGroupKey: 'k' });
  createWamInstance.mockReset();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.stubGlobal('OfflineAudioContext', MockOfflineContext as any);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('exportAudioImpl', () => {
  it('renders through an OfflineAudioContext sized from options and host', async () => {
    const host = makeHost();
    const buffer = await exportAudioImpl(host, { sampleRate: 44100, channels: 1, duration: 2 });

    expect(offlineInstances).toHaveLength(1);
    expect(offlineInstances[0].options).toEqual({
      numberOfChannels: 1,
      length: 2 * 44100,
      sampleRate: 44100,
    });
    expect(buffer).toBe(offlineInstances[0].renderedBuffer);
  });

  it('defaults to host duration, stereo, and the host sample rate', async () => {
    await exportAudioImpl(makeHost());
    expect(offlineInstances[0].options).toEqual({
      numberOfChannels: 2,
      length: 4 * 48000,
      sampleRate: 48000,
    });
  });

  it('schedules clip sources with when/offset/duration and clip gain', async () => {
    await exportAudioImpl(makeHost());

    const ctx = offlineInstances[0];
    expect(ctx.sources).toHaveLength(1);
    // start at 1s, 0.5s into the file, for 2s
    expect(ctx.sources[0].start).toHaveBeenCalledWith(1, 0.5, 2);
    // clip gain 0.5 applied somewhere in the source chain
    expect(ctx.gains.some((g) => g.gain.value === 0.5)).toBe(true);
    // track volume 0.8 applied
    expect(ctx.gains.some((g) => g.gain.value === 0.8)).toBe(true);
  });

  it('clips the render window: startTime mid-clip shifts offset, pre-window clips are skipped', async () => {
    const host = makeHost({
      tracks: [
        {
          id: 'track-1',
          volume: 1,
          pan: 0,
          muted: false,
          soloed: false,
          clips: [
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            makeClip() as any, // 1s..3s
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            makeClip({ id: 'clip-2', startSample: 0, durationSamples: 48000 }) as any, // 0..1s
          ],
        },
      ],
    });

    await exportAudioImpl(host, { startTime: 2, duration: 2 });

    const ctx = offlineInstances[0];
    // clip-2 ends exactly at the window start — skipped entirely
    expect(ctx.sources).toHaveLength(1);
    // clip-1: window starts 1s into it → when 0, offset 0.5+1, remaining 1s
    expect(ctx.sources[0].start).toHaveBeenCalledWith(0, 1.5, 1);
  });

  it('skips muted tracks and honors solo', async () => {
    const host = makeHost({
      tracks: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: 'a', volume: 1, pan: 0, muted: true, soloed: false, clips: [makeClip() as any] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: 'b', volume: 1, pan: 0, muted: false, soloed: true, clips: [makeClip() as any] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: 'c', volume: 1, pan: 0, muted: false, soloed: false, clips: [makeClip() as any] },
      ],
    });

    await exportAudioImpl(host);

    // Only the soloed track renders (a is muted; c is non-soloed while b solos).
    expect(offlineInstances[0].sources).toHaveLength(1);
  });

  it('rebuilds native chains offline, reproducing both bypass modes', async () => {
    const master: SerializedEffectEntry[] = [
      { kind: 'native', type: 'native-delay', params: { wet: 0.4 }, bypassed: true }, // wet-bypass
      { kind: 'native', type: 'native-compressor', params: {}, bypassed: true }, // disconnect-bypass
      { kind: 'native', type: 'native-filter', params: { frequency: 800 }, bypassed: false },
    ];
    const host = makeHost({ getMasterEffectsState: vi.fn(async () => master) });

    await exportAudioImpl(host);
    const ctx = offlineInstances[0];

    // Active filter created with its params applied.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyCtx = ctx as any;
    expect(anyCtx.sources.length).toBe(1);
    // wet-bypassed delay exists but with wet zeroed → some gain at 0
    expect(ctx.gains.some((g) => g.gain.value === 0)).toBe(true);
  });

  it('re-instantiates WAM entries on the offline context with saved state and destroys them after render', async () => {
    const destroy = vi.fn();
    createWamInstance.mockResolvedValue({
      url: 'https://x/p.js',
      descriptor: { name: 'P' },
      audioNode: mockNode(),
      destroy,
    });
    const master: SerializedEffectEntry[] = [
      { kind: 'wam', url: 'https://x/p.js', bypassed: false, state: { preset: 'big' } },
    ];
    const host = makeHost({ getMasterEffectsState: vi.fn(async () => master) });

    await exportAudioImpl(host);

    const ctx = offlineInstances[0];
    expect(ensureWamHost).toHaveBeenCalledWith(ctx);
    expect(createWamInstance).toHaveBeenCalledWith('https://x/p.js', ctx, 'off-group', {
      initialState: { preset: 'big' },
    });
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('destroys offline WAM instances even when rendering fails', async () => {
    const destroy = vi.fn();
    createWamInstance.mockResolvedValue({
      url: 'https://x/p.js',
      descriptor: { name: 'P' },
      audioNode: mockNode(),
      destroy,
    });
    const host = makeHost({
      getMasterEffectsState: vi.fn(
        async () =>
          [{ kind: 'wam', url: 'https://x/p.js', bypassed: false }] as SerializedEffectEntry[]
      ),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.stubGlobal(
      'OfflineAudioContext',
      class extends MockOfflineContext {
        startRendering = vi.fn(async () => {
          throw new Error('render blew up');
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any
    );

    await expect(exportAudioImpl(host)).rejects.toThrow('render blew up');
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('destroys already-created plugins when a later chain entry fails to build', async () => {
    const destroyA = vi.fn();
    const destroyB = vi.fn();
    createWamInstance
      .mockResolvedValueOnce({
        url: 'https://x/a.js',
        descriptor: { name: 'A' },
        audioNode: mockNode(),
        destroy: destroyA,
      })
      .mockResolvedValueOnce({
        url: 'https://x/b.js',
        descriptor: { name: 'B' },
        audioNode: mockNode(),
        destroy: destroyB,
      })
      .mockRejectedValueOnce(new Error('third plugin unreachable'));
    const master: SerializedEffectEntry[] = [
      { kind: 'wam', url: 'https://x/a.js', bypassed: false },
      { kind: 'wam', url: 'https://x/b.js', bypassed: false },
      { kind: 'wam', url: 'https://x/c.js', bypassed: false },
    ];
    const host = makeHost({ getMasterEffectsState: vi.fn(async () => master) });

    await expect(exportAudioImpl(host)).rejects.toThrow('third plugin unreachable');

    expect(destroyA).toHaveBeenCalledTimes(1);
    expect(destroyB).toHaveBeenCalledTimes(1);
  });

  it('skips bypassed WAM entries without instantiating them', async () => {
    const host = makeHost({
      getMasterEffectsState: vi.fn(
        async () =>
          [{ kind: 'wam', url: 'https://x/p.js', bypassed: true }] as SerializedEffectEntry[]
      ),
    });

    await exportAudioImpl(host);

    expect(createWamInstance).not.toHaveBeenCalled();
  });
});
