import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadWamFactory,
  createWamInstance,
  createWamInstanceFromFactory,
  cloneInstanceInto,
  _resetWamFactoryCacheForTests,
} from '../src/loader';
import type { WamFactory } from '../src/loader';

/** The mocks are structural (no real AudioNode) — cast for direct factory calls. */
const asFactory = (mockClass: unknown) => mockClass as WamFactory;

function makeDescriptor(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Reverb',
    vendor: 'Test Vendor',
    version: '1.0.0',
    apiVersion: '2.0.0',
    hasAudioInput: true,
    hasAudioOutput: true,
    ...overrides,
  };
}

function makeAudioNode() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    destroy: vi.fn(),
    getState: vi.fn(async () => ({ preset: 'hall' })),
    setState: vi.fn(async () => undefined),
    getParameterInfo: vi.fn(async () => ({})),
  };
}

function makeWamClass(descriptorOverrides: Record<string, unknown> = {}) {
  const audioNode = makeAudioNode();
  const instance = {
    descriptor: makeDescriptor(descriptorOverrides),
    audioNode,
  };
  const WamClass = {
    createInstance: vi.fn(async () => instance),
  };
  return { WamClass, instance, audioNode };
}

function makeImportFn(moduleValue: unknown) {
  return vi.fn(async () => moduleValue);
}

const URL_A = 'https://plugins.example.com/reverb/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = { sampleRate: 48000 } as any;

beforeEach(() => {
  _resetWamFactoryCacheForTests();
});

describe('loadWamFactory', () => {
  it('imports the module and resolves its default export', async () => {
    const { WamClass } = makeWamClass();
    const importFn = makeImportFn({ default: WamClass });

    const factory = await loadWamFactory(URL_A, importFn);

    expect(importFn).toHaveBeenCalledWith(URL_A);
    expect(factory).toBe(WamClass);
  });

  it('caches the factory — second load does not re-import', async () => {
    const { WamClass } = makeWamClass();
    const importFn = makeImportFn({ default: WamClass });

    const first = await loadWamFactory(URL_A, importFn);
    const second = await loadWamFactory(URL_A, importFn);

    expect(importFn).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('concurrent loads share one in-flight import', async () => {
    const { WamClass } = makeWamClass();
    const importFn = makeImportFn({ default: WamClass });

    const [a, b] = await Promise.all([
      loadWamFactory(URL_A, importFn),
      loadWamFactory(URL_A, importFn),
    ]);

    expect(importFn).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
  });

  it('a failing destroy during cleanup does not mask the validation error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { WamClass, audioNode } = makeWamClass({ hasAudioInput: false });
    audioNode.destroy.mockImplementation(() => {
      throw new Error('teardown exploded');
    });
    const importFn = makeImportFn({ default: WamClass });

    await expect(createWamInstance(URL_A, ctx, 'group-1', { importFn })).rejects.toThrow(
      /audio input/i
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('teardown exploded'));
    warn.mockRestore();
  });

  it('evicts a failed load so a retry re-imports', async () => {
    const { WamClass } = makeWamClass();
    const importFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ default: WamClass });

    await expect(loadWamFactory(URL_A, importFn)).rejects.toThrow('network down');
    const factory = await loadWamFactory(URL_A, importFn);

    expect(importFn).toHaveBeenCalledTimes(2);
    expect(factory).toBe(WamClass);
  });

  it('rejects a module without a usable default export, naming the url', async () => {
    const importFn = makeImportFn({ default: undefined });

    await expect(loadWamFactory(URL_A, importFn)).rejects.toThrow(
      new RegExp('\\[waveform-playlist\\][\\s\\S]*' + 'plugins\\.example\\.com')
    );
  });
});

describe('createWamInstance', () => {
  it('instantiates via createInstance(hostGroupId, audioContext) and exposes the descriptor', async () => {
    const { WamClass, audioNode } = makeWamClass();
    const importFn = makeImportFn({ default: WamClass });

    const plugin = await createWamInstance(URL_A, ctx, 'group-1', { importFn });

    expect(WamClass.createInstance).toHaveBeenCalledWith('group-1', ctx);
    expect(plugin.url).toBe(URL_A);
    expect(plugin.descriptor.name).toBe('Test Reverb');
    expect(plugin.audioNode).toBe(audioNode);
  });

  it('rejects a descriptor without a compatible apiVersion and destroys the instance', async () => {
    const { WamClass, audioNode } = makeWamClass({ apiVersion: '1.0.0' });
    const importFn = makeImportFn({ default: WamClass });

    await expect(createWamInstance(URL_A, ctx, 'group-1', { importFn })).rejects.toThrow(
      /apiVersion/
    );
    expect(audioNode.destroy).toHaveBeenCalled();
  });

  it('rejects an instrument-only plugin (no audio input) with an explanatory error', async () => {
    const { WamClass, audioNode } = makeWamClass({ hasAudioInput: false });
    const importFn = makeImportFn({ default: WamClass });

    await expect(createWamInstance(URL_A, ctx, 'group-1', { importFn })).rejects.toThrow(
      /audio input/i
    );
    expect(audioNode.destroy).toHaveBeenCalled();
  });

  it('accepts a faust2wam-shaped descriptor with no special handling (#429)', async () => {
    // Mirrors what faust2wam generates: apiVersion 2.0.0, audio in/out,
    // hasMidiInput always true (even for pure effects), plus a vendor
    // extension field (faustMeta). None of it should need host-side support.
    const { WamClass } = makeWamClass({
      identifier: 'fr.grame.faust.lowpass',
      name: 'Lowpass',
      vendor: 'Faust User',
      isInstrument: false,
      hasMidiInput: true,
      hasMidiOutput: false,
      faustMeta: { poly: false, fft: false, effect: null },
    });
    const importFn = makeImportFn({ default: WamClass });

    const plugin = await createWamInstance(URL_A, ctx, 'group-1', { importFn });

    expect(plugin.descriptor.name).toBe('Lowpass');
  });

  it('applies a flat Faust parameter-map state as initialState (#429)', async () => {
    // Faust WAM getState() returns a flat { "/Name/param": value } map, not
    // a { params: ... } envelope — the host must treat it as opaque.
    const { WamClass, audioNode } = makeWamClass();
    const importFn = makeImportFn({ default: WamClass });
    const faustState = { '/Lowpass/cutoff': 250 };

    await createWamInstance(URL_A, ctx, 'group-1', { importFn, initialState: faustState });

    expect(audioNode.setState).toHaveBeenCalledWith(faustState);
  });

  it('applies initialState via the audio node', async () => {
    const { WamClass, audioNode } = makeWamClass();
    const importFn = makeImportFn({ default: WamClass });
    const state = { preset: 'plate' };

    await createWamInstance(URL_A, ctx, 'group-1', { importFn, initialState: state });

    expect(audioNode.setState).toHaveBeenCalledWith(state);
  });

  it('destroy() tears down the audio node and is safe to call twice', async () => {
    const { WamClass, audioNode } = makeWamClass();
    const importFn = makeImportFn({ default: WamClass });

    const plugin = await createWamInstance(URL_A, ctx, 'group-1', { importFn });
    plugin.destroy();
    plugin.destroy();

    expect(audioNode.destroy).toHaveBeenCalledTimes(1);
  });

  it('getState/setState/getParameterInfo delegate to the audio node', async () => {
    const { WamClass, audioNode } = makeWamClass();
    const importFn = makeImportFn({ default: WamClass });

    const plugin = await createWamInstance(URL_A, ctx, 'group-1', { importFn });
    await expect(plugin.getState()).resolves.toEqual({ preset: 'hall' });
    await plugin.setState({ preset: 'room' });
    await plugin.getParameterInfo();

    expect(audioNode.setState).toHaveBeenCalledWith({ preset: 'room' });
    expect(audioNode.getParameterInfo).toHaveBeenCalled();
  });

  it('exposes createGui/destroyGui passthroughs when the module ships a GUI', async () => {
    const { WamClass, instance } = makeWamClass();
    const guiElement = { nodeType: 1 } as unknown as HTMLElement;
    const moduleWithGui = Object.assign(instance, {
      createGui: vi.fn(async () => guiElement),
      destroyGui: vi.fn(),
    });
    const importFn = makeImportFn({ default: WamClass });

    const plugin = await createWamInstance(URL_A, ctx, 'group-1', { importFn });

    expect(typeof plugin.createGui).toBe('function');
    expect(typeof plugin.destroyGui).toBe('function');
    await expect(plugin.createGui!()).resolves.toBe(guiElement);
    expect(moduleWithGui.createGui).toHaveBeenCalledTimes(1);
    plugin.destroyGui!(guiElement);
    expect(moduleWithGui.destroyGui).toHaveBeenCalledWith(guiElement);
  });

  it('leaves createGui/destroyGui undefined for headless modules', async () => {
    const { WamClass } = makeWamClass();
    const importFn = makeImportFn({ default: WamClass });

    const plugin = await createWamInstance(URL_A, ctx, 'group-1', { importFn });

    expect(plugin.createGui).toBeUndefined();
    expect(plugin.destroyGui).toBeUndefined();
  });
});

describe('createWamInstanceFromFactory', () => {
  it('instantiates via createInstance(hostGroupId, audioContext) without any module load', async () => {
    const { WamClass, audioNode } = makeWamClass();

    const plugin = await createWamInstanceFromFactory(asFactory(WamClass), ctx, 'group-1');

    expect(WamClass.createInstance).toHaveBeenCalledWith('group-1', ctx);
    expect(plugin.descriptor.name).toBe('Test Reverb');
    expect(plugin.audioNode).toBe(audioNode);
    // No URL — the factory came from somewhere other than a module load
    // (e.g. an in-browser Faust compile).
    expect(plugin.url).toBeUndefined();
  });

  it('validates the descriptor after instantiation and destroys invalid instances', async () => {
    const { WamClass, audioNode } = makeWamClass({ hasAudioOutput: false });

    await expect(createWamInstanceFromFactory(asFactory(WamClass), ctx, 'group-1')).rejects.toThrow(
      /audio output/i
    );
    expect(audioNode.destroy).toHaveBeenCalled();
  });

  it('names the failing plugin via the label option in validation errors', async () => {
    const { WamClass } = makeWamClass({ apiVersion: '1.0.0' });

    await expect(
      createWamInstanceFromFactory(asFactory(WamClass), ctx, 'group-1', { label: 'My Lowpass' })
    ).rejects.toThrow(/My Lowpass/);
  });

  it('applies initialState via the audio node, destroying the instance when it fails', async () => {
    const { WamClass, audioNode } = makeWamClass();
    const state = { '/Lowpass/cutoff': 250 };

    await createWamInstanceFromFactory(asFactory(WamClass), ctx, 'group-1', { initialState: state });
    expect(audioNode.setState).toHaveBeenCalledWith(state);

    const failing = makeWamClass();
    failing.audioNode.setState.mockRejectedValueOnce(new Error('bad state'));
    await expect(
      createWamInstanceFromFactory(asFactory(failing.WamClass), ctx, 'group-1', {
        initialState: state,
      })
    ).rejects.toThrow('bad state');
    expect(failing.audioNode.destroy).toHaveBeenCalled();
  });

  it('exposes GUI passthroughs and an idempotent destroy, like the url path', async () => {
    const { WamClass, instance, audioNode } = makeWamClass();
    const guiElement = { nodeType: 1 } as unknown as HTMLElement;
    Object.assign(instance, {
      createGui: vi.fn(async () => guiElement),
      destroyGui: vi.fn(),
    });

    const plugin = await createWamInstanceFromFactory(asFactory(WamClass), ctx, 'group-1');

    await expect(plugin.createGui!()).resolves.toBe(guiElement);
    plugin.destroy();
    plugin.destroy();
    expect(audioNode.destroy).toHaveBeenCalledTimes(1);
  });
});

describe('cloneInstanceInto', () => {
  it('re-instantiates on the target context with the live instance state', async () => {
    const { WamClass, audioNode } = makeWamClass();
    const importFn = makeImportFn({ default: WamClass });
    const live = await createWamInstance(URL_A, ctx, 'group-1', { importFn });
    audioNode.getState.mockResolvedValueOnce({ preset: 'cathedral' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const offlineCtx = { sampleRate: 48000 } as any;
    const clone = await cloneInstanceInto(live, offlineCtx, 'offline-group');

    // Factory came from the cache — no re-import.
    expect(importFn).toHaveBeenCalledTimes(1);
    expect(WamClass.createInstance).toHaveBeenLastCalledWith('offline-group', offlineCtx);
    // The clone received the live instance's state snapshot.
    expect(audioNode.setState).toHaveBeenCalledWith({ preset: 'cathedral' });
    expect(clone.url).toBe(URL_A);
  });

  it('rejects a factory-created (url-less) instance with an explanatory error', async () => {
    const { WamClass } = makeWamClass();
    const live = await createWamInstanceFromFactory(asFactory(WamClass), ctx, 'group-1');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const offlineCtx = { sampleRate: 48000 } as any;
    await expect(cloneInstanceInto(live, offlineCtx, 'offline-group')).rejects.toThrow(
      /no source URL/i
    );
  });
});
