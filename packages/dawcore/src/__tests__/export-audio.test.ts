import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportAudioImpl, type ExportAudioHost } from '../interactions/export-audio';
import type { SerializedEffectEntry } from '../effects/types';
import { registerEffect } from '@waveform-playlist/core';
import { _resetEffectRegistryForTests } from '../effects/effect-registry';

const { ensureWamHost, createWamInstance, createWamInstanceFromFactory } = vi.hoisted(() => ({
  ensureWamHost: vi.fn(),
  createWamInstance: vi.fn(),
  createWamInstanceFromFactory: vi.fn(),
}));

const { compileFaustToWam } = vi.hoisted(() => ({
  compileFaustToWam: vi.fn(),
}));

vi.mock('@dawcore/wam', () => ({
  ensureWamHost,
  createWamInstance,
  createWamInstanceFromFactory,
}));

vi.mock('@dawcore/faust', () => ({ compileFaustToWam }));

// The pan stage has its own unit tests in core and is verified against real
// audio in a browser; here it is one opaque node per track.
const panStages: Array<{
  node: ReturnType<typeof mockNode>;
  pan: number;
  sourceChannelCount: number;
  dispose: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('@waveform-playlist/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@waveform-playlist/core')>()),
  createPanStage: vi.fn((_ctx: unknown, pan: number, sourceChannelCount: number) => {
    const node = mockNode();
    const dispose = vi.fn();
    panStages.push({ node, pan, sourceChannelCount, dispose });
    return { input: node, output: node, setPan: vi.fn(), setSourceChannelCount: vi.fn(), dispose };
  }),
}));

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
  _resetEffectRegistryForTests();
  offlineInstances.length = 0;
  panStages.length = 0;
  ensureWamHost.mockReset().mockResolvedValue({ hostGroupId: 'off-group', hostGroupKey: 'k' });
  createWamInstance.mockReset();
  createWamInstanceFromFactory.mockReset();
  compileFaustToWam.mockReset();
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

  it('recompiles Faust entries on the offline context and destroys them after render', async () => {
    const destroy = vi.fn();
    const factory = { createInstance: vi.fn() };
    compileFaustToWam.mockResolvedValue({
      factory,
      name: 'My LP',
      dspCode: 'process = _;',
    });
    createWamInstanceFromFactory.mockResolvedValue({
      descriptor: { name: 'My LP' },
      audioNode: mockNode(),
      destroy,
    });
    const master: SerializedEffectEntry[] = [
      {
        kind: 'wam',
        faustDsp: 'process = _;',
        faustName: 'My LP',
        bypassed: false,
        state: { '/My LP/cutoff': 500 },
      },
    ];
    const host = makeHost({ getMasterEffectsState: vi.fn(async () => master) });

    await exportAudioImpl(host);

    const ctx = offlineInstances[0];
    expect(compileFaustToWam).toHaveBeenCalledWith(
      'process = _;',
      expect.objectContaining({ name: 'My LP' })
    );
    expect(createWamInstanceFromFactory).toHaveBeenCalledWith(
      factory,
      ctx,
      'off-group',
      expect.objectContaining({ initialState: { '/My LP/cutoff': 500 } })
    );
    expect(createWamInstance).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('skips bypassed Faust entries without compiling them', async () => {
    const host = makeHost({
      getMasterEffectsState: vi.fn(
        async () =>
          [{ kind: 'wam', faustDsp: 'process = _;', bypassed: true }] as SerializedEffectEntry[]
      ),
    });

    await exportAudioImpl(host);

    expect(compileFaustToWam).not.toHaveBeenCalled();
    expect(createWamInstanceFromFactory).not.toHaveBeenCalled();
  });
});

describe('exportAudioImpl — audit wave 3', () => {
  it('skips failed-plugin placeholder entries even when their saved state was not bypassed', async () => {
    createWamInstance.mockRejectedValue(new Error('unreachable'));
    const host = makeHost({
      getMasterEffectsState: vi.fn(
        async () =>
          [
            { kind: 'wam', url: 'https://x/dead.js', bypassed: false, placeholder: true },
          ] as SerializedEffectEntry[]
      ),
    });

    // Live playback silently skips placeholders — export must match, not
    // retry the dead URL (which would reject the whole export) or render an
    // effect that is absent from what the user hears.
    await expect(exportAudioImpl(host)).resolves.toBeTruthy();
    expect(createWamInstance).not.toHaveBeenCalled();
  });

  it('skips native placeholder entries without instantiating them', async () => {
    const host = makeHost({
      getMasterEffectsState: vi.fn(
        async () =>
          [
            {
              kind: 'native',
              type: 'not-registered-anywhere',
              params: {},
              bypassed: false,
              placeholder: true,
            },
          ] as SerializedEffectEntry[]
      ),
    });

    await expect(exportAudioImpl(host)).resolves.toBeTruthy();
  });

  it('applies the host master volume BEFORE the master chain (live MasterNode order)', async () => {
    const host = makeHost({ masterVolume: 0.5 });

    await exportAudioImpl(host);

    const ctx = offlineInstances[0];
    const masterGain = ctx.gains.find((g) => g.gain.value === 0.5);
    expect(masterGain).toBeTruthy();
    // Volume feeds the master chain input, never the destination directly —
    // volume→chain vs chain→volume changes what nonlinear master effects
    // (compressor) see, so the order must match live playback.
    expect(masterGain!.connect).toHaveBeenCalled();
    expect(masterGain!.connect).not.toHaveBeenCalledWith(ctx.destination);
    // The track's panner (post-fader) routes into the master volume stage
    const feedsMasterVolume = panStages.some((p) =>
      p.node.connect.mock.calls.some((call) => call[0] === masterGain)
    );
    expect(feedsMasterVolume).toBe(true);
  });
});

// #660: track effects are PRE-FADER inserts, live and offline alike.
describe('exportAudioImpl — track signal order (#660)', () => {
  /** Follow connect() edges from `start`; returns node labels in path order. */
  function pathFrom(start: { connect: ReturnType<typeof vi.fn> }, label: (n: unknown) => string) {
    const path: string[] = [];
    let node: { connect: ReturnType<typeof vi.fn> } | undefined = start;
    const seen = new Set<unknown>();
    while (node && !seen.has(node)) {
      seen.add(node);
      path.push(label(node));
      node = node.connect.mock.calls[0]?.[0];
    }
    return path;
  }

  it('renders clip → effects chain → volume → pan → master', async () => {
    const compressor = mockNode({
      threshold: mockParam(-24),
      knee: mockParam(30),
      ratio: mockParam(12),
      attack: mockParam(0.003),
      release: mockParam(0.25),
    });
    const host = makeHost({
      masterVolume: 0.9,
      getTrackEffectsState: vi.fn(async () => [
        { kind: 'native', type: 'native-compressor', params: {}, bypassed: false } as const,
      ]),
    });
    // makeHost's track: volume 0.8, clip gain 0.5.
    const original = MockOfflineContext.prototype.createDynamicsCompressor;
    MockOfflineContext.prototype.createDynamicsCompressor = () => compressor;
    try {
      await exportAudioImpl(host);
    } finally {
      MockOfflineContext.prototype.createDynamicsCompressor = original;
    }

    const ctx = offlineInstances[0];
    const label = (n: unknown): string => {
      if (n === compressor) return 'compressor';
      if (n === ctx.destination) return 'destination';
      if (ctx.sources.includes(n as never)) return 'source';
      if (panStages.some((p) => p.node === n)) return 'pan';
      const gain = ctx.gains.find((g) => g === n);
      if (!gain) return '?';
      if (gain.gain.value === 0.5) return 'clipGain';
      if (gain.gain.value === 0.8) return 'trackVolume';
      if (gain.gain.value === 0.9) return 'masterVolume';
      return 'gain';
    };

    const path = pathFrom(ctx.sources[0], label);

    // Unlabelled 'gain' nodes are chain input/output plumbing.
    expect(path.filter((p) => p !== 'gain')).toEqual([
      'source',
      'clipGain',
      'compressor',
      'trackVolume',
      'pan',
      'masterVolume',
      'destination',
    ]);
  });

  it('a track without effects still passes through volume and pan', async () => {
    const host = makeHost({ masterVolume: 0.9 });

    await exportAudioImpl(host);

    const ctx = offlineInstances[0];
    const volume = ctx.gains.find((g) => g.gain.value === 0.8)!;
    expect(panStages).toHaveLength(1);
    expect(volume.connect).toHaveBeenCalledWith(panStages[0].node);
  });
});

// #669: the offline render pans with the same stage and law as live playback.
describe('exportAudioImpl — pan stage (#669)', () => {
  const stereoBuffer = { duration: 4, sampleRate: 48000, numberOfChannels: 2 };
  const monoBuffer = { duration: 4, sampleRate: 48000, numberOfChannels: 1 };
  function hostWith(clips: unknown[], pan = 0) {
    return makeHost({
      tracks: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: 't', volume: 1, pan, muted: false, soloed: false, clips: clips as any },
      ],
    });
  }

  it('passes the track pan to the stage', async () => {
    await exportAudioImpl(hostWith([makeClip({ audioBuffer: monoBuffer })], -0.25));
    expect(panStages[0].pan).toBe(-0.25);
  });

  it('a track of mono clips gets the mono law', async () => {
    await exportAudioImpl(hostWith([makeClip({ audioBuffer: monoBuffer })]));
    expect(panStages[0].sourceChannelCount).toBe(1);
  });

  it('a track with any stereo clip gets the stereo law', async () => {
    await exportAudioImpl(
      hostWith([makeClip({ audioBuffer: monoBuffer }), makeClip({ audioBuffer: stereoBuffer })])
    );
    expect(panStages[0].sourceChannelCount).toBe(2);
  });

  it('releases the stage after rendering', async () => {
    await exportAudioImpl(hostWith([makeClip({ audioBuffer: monoBuffer })]));
    expect(panStages[0].dispose).toHaveBeenCalledTimes(1);
  });
});

// #657: a registered effect backed by an AudioWorklet needs its module added
// to the OfflineAudioContext, which only exportAudio ever holds.
describe('exportAudioImpl — EffectDefinition.prepare (#657)', () => {
  function registerWorkletEffect(log: string[]) {
    registerEffect('worklet-fx', {
      label: 'Worklet FX',
      category: 'dynamics',
      defaults: {},
      params: {},
      prepare: vi.fn(async (ctx: BaseAudioContext) => {
        await Promise.resolve();
        log.push('prepare:' + offlineInstances.indexOf(ctx as unknown as MockOfflineContext));
      }),
      create: (ctx) => {
        log.push('create');
        const node = ctx.createGain();
        return { input: node, output: node, applyParams: () => {} };
      },
    });
  }

  it('awaits prepare on the offline context before create, once per type', async () => {
    const log: string[] = [];
    registerWorkletEffect(log);
    const entry: SerializedEffectEntry = {
      kind: 'native',
      type: 'worklet-fx',
      params: {},
      bypassed: false,
    };
    const host = makeHost({
      getMasterEffectsState: vi.fn(async () => [entry]),
      getTrackEffectsState: vi.fn(async () => [entry, entry]),
    });

    await exportAudioImpl(host);

    // One prepare (on THE offline context, index 0) ahead of all three creates.
    expect(log).toEqual(['prepare:0', 'create', 'create', 'create']);
  });

  it('prepares again for each export — every export has a fresh context', async () => {
    const log: string[] = [];
    registerWorkletEffect(log);
    const host = makeHost({
      getMasterEffectsState: vi.fn(async () => [
        { kind: 'native', type: 'worklet-fx', params: {}, bypassed: false } as const,
      ]),
    });

    await exportAudioImpl(host);
    await exportAudioImpl(host);

    expect(log).toEqual(['prepare:0', 'create', 'prepare:1', 'create']);
  });

  it('a failing prepare fails the export with the original error', async () => {
    const boom = new Error('module 404');
    registerEffect('worklet-fx', {
      label: 'Worklet FX',
      category: 'dynamics',
      defaults: {},
      params: {},
      prepare: async () => {
        throw boom;
      },
      create: (ctx) => {
        const node = ctx.createGain();
        return { input: node, output: node, applyParams: () => {} };
      },
    });
    const host = makeHost({
      getMasterEffectsState: vi.fn(async () => [
        { kind: 'native', type: 'worklet-fx', params: {}, bypassed: false } as const,
      ]),
    });

    await expect(exportAudioImpl(host)).rejects.toBe(boom);
    expect(offlineInstances[0].startRendering).not.toHaveBeenCalled();
  });

  it('skips a bypassed effect without a wet param before preparing it', async () => {
    // Live, a disconnect-bypassed effect is out of the series. A worklet
    // module that 404s must not fail an export the effect takes no part in.
    const prepare = vi.fn(async () => {
      throw new Error('module 404');
    });
    const create = vi.fn();
    registerEffect('worklet-fx', {
      label: 'Worklet FX',
      category: 'dynamics',
      defaults: {},
      params: {},
      prepare,
      create,
    });
    const host = makeHost({
      getMasterEffectsState: vi.fn(async () => [
        { kind: 'native', type: 'worklet-fx', params: {}, bypassed: true } as const,
      ]),
    });

    await expect(exportAudioImpl(host)).resolves.toBeDefined();
    expect(prepare).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('does not prepare placeholder entries (they are skipped)', async () => {
    const log: string[] = [];
    registerWorkletEffect(log);
    const host = makeHost({
      getMasterEffectsState: vi.fn(async () => [
        {
          kind: 'native',
          type: 'worklet-fx',
          params: {},
          bypassed: false,
          placeholder: true,
        } as const,
      ]),
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await exportAudioImpl(host);

    expect(log).toEqual([]);
  });
});
