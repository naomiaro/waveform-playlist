import { describe, it, expect, vi } from 'vitest';

vi.mock('tone', () => {
  const connect = vi.fn();
  const disconnect = vi.fn();
  return { connect, disconnect };
});

import { createWamEffectInstance } from '../effects/wamEffectFactory';
import type { WamPluginInstance } from '@dawcore/wam';
import { connect, disconnect } from 'tone';

function makePlugin(): WamPluginInstance {
  return {
    url: 'https://example.com/plugin/index.js',
    descriptor: { name: 'BigMuff' } as WamPluginInstance['descriptor'],
    audioNode: {
      setParameterValues: vi.fn().mockResolvedValue(undefined),
    } as unknown as WamPluginInstance['audioNode'],
    getState: vi.fn(),
    setState: vi.fn(),
    getParameterInfo: vi.fn(),
    destroy: vi.fn(),
  } as unknown as WamPluginInstance;
}

describe('createWamEffectInstance', () => {
  it('wraps the plugin audioNode as the chain effect node', () => {
    const plugin = makePlugin();
    const inst = createWamEffectInstance(plugin);
    expect(inst.kind).toBe('wam');
    expect(inst.effect).toBe(plugin.audioNode);
    expect(inst.url).toBe(plugin.url);
    expect(inst.instanceId).toMatch(/^wam_/);
  });

  it('dispose destroys the plugin', () => {
    const plugin = makePlugin();
    createWamEffectInstance(plugin).dispose();
    expect(plugin.destroy).toHaveBeenCalled();
  });

  it('connect/disconnect route through the tone helpers (native↔Tone bridging)', () => {
    const plugin = makePlugin();
    const inst = createWamEffectInstance(plugin);
    const dest = {} as never;
    inst.connect(dest);
    expect(connect).toHaveBeenCalledWith(plugin.audioNode, dest);
    inst.disconnect();
    expect(disconnect).toHaveBeenCalledWith(plugin.audioNode);
  });

  it('setParameter forwards numeric values to setParameterValues', () => {
    const plugin = makePlugin();
    const inst = createWamEffectInstance(plugin);
    inst.setParameter('drive', 0.7);
    expect(
      (plugin.audioNode as unknown as { setParameterValues: ReturnType<typeof vi.fn> })
        .setParameterValues
    ).toHaveBeenCalledWith({ drive: { id: 'drive', value: 0.7, normalized: false } });
  });
});
