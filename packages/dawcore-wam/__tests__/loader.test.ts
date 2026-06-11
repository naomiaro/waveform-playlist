import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadWamFactory,
  createWamInstance,
  _resetWamFactoryCacheForTests,
} from '../src/loader';

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
});
