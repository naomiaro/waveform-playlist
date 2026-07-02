/**
 * WAM-flavored EffectInstance. The plugin's audioNode (a native
 * AudioWorkletNode) joins the same ordered chain as Tone effects; linking
 * goes through Tone's connect()/disconnect() helpers, which bridge
 * native↔Tone in both directions. Requires native-context mode (the caller
 * guards; see useDynamicEffects.addWamEffect).
 */
import { connect, disconnect } from 'tone';
import type { InputNode } from 'tone';
import type { WamPluginInstance } from '@dawcore/wam'; // type-only — erased at runtime
import type { EffectInstance } from './effectFactory';

export interface WamEffectInstance extends EffectInstance {
  kind: 'wam';
  plugin: WamPluginInstance;
  url?: string;
}

interface WamParamTarget {
  setParameterValues?: (
    values: Record<string, { id: string; value: number; normalized: boolean }>
  ) => Promise<void>;
}

let wamInstanceCounter = 0;

export function createWamEffectInstance(plugin: WamPluginInstance): WamEffectInstance {
  const node = plugin.audioNode as unknown as AudioNode;
  const instanceId = 'wam_' + ++wamInstanceCounter;
  return {
    kind: 'wam',
    plugin,
    url: plugin.url,
    effect: node,
    id: 'wam:' + (plugin.descriptor?.name ?? plugin.url ?? 'plugin'),
    instanceId,
    dispose: () => plugin.destroy(),
    setParameter: (name, value) => {
      if (typeof value !== 'number') return;
      const target = plugin.audioNode as unknown as WamParamTarget;
      void target.setParameterValues?.({ [name]: { id: name, value, normalized: false } });
    },
    getParameter: () => undefined, // WAM params are async; read via the plugin GUI
    connect: (destination: InputNode) => connect(node, destination),
    disconnect: () => disconnect(node),
  };
}
