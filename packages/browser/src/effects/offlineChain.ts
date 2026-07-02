/**
 * Shared offline effects chain builder for WAV export (master + per-track).
 * Natives are re-created fresh on the current (offline) context; WAM entries
 * are re-instantiated on the offline context from their URL-cached factories
 * with the live instance's state transferred (cloneInstanceInto — worklets
 * are context-bound). Any failure disposes the partially-built chain and
 * rethrows: a WAV export must never silently render without an effect the
 * live chain has (#536).
 */
import { connect } from 'tone';
import type { ToneAudioNode } from 'tone';
import type { WamPluginInstance } from '@dawcore/wam'; // type-only — erased at runtime
import type { EffectDefinition } from './effectDefinitions';
import { createEffectInstance, type EffectInstance } from './effectFactory';
import { createWamEffectInstance } from './wamEffectFactory';
import { loadWamModule } from './loadWam';

/** Structural subset of ActiveEffect / TrackActiveEffect used offline. */
export interface OfflineChainEntry {
  instanceId: string;
  kind: 'native' | 'wam';
  definition: EffectDefinition;
  params: Record<string, number | string | boolean>;
}

export interface OfflineChain {
  /** Offline effect instances, in chain order. */
  instances: EffectInstance[];
  /** Disposes every offline instance (destroys WAM clones). Never throws. */
  dispose: () => void;
}

export async function buildOfflineChain(
  entries: OfflineChainEntry[],
  getLivePlugin: (instanceId: string) => WamPluginInstance | undefined,
  rawContext: BaseAudioContext
): Promise<OfflineChain> {
  const instances: EffectInstance[] = [];
  const dispose = (): void => {
    // EffectInstance.dispose implementations catch internally — safe to run all.
    instances.forEach((inst) => inst.dispose());
  };
  try {
    for (const entry of entries) {
      if (entry.kind === 'native') {
        instances.push(createEffectInstance(entry.definition, entry.params));
        continue;
      }
      const livePlugin = getLivePlugin(entry.instanceId);
      if (!livePlugin) {
        throw new Error(
          '[waveform-playlist] WAV export: no live WAM plugin found for "' +
            entry.definition.name +
            '" (' +
            entry.instanceId +
            ') — cannot re-instantiate it offline.'
        );
      }
      const wam = await loadWamModule();
      // ensureWamHost is idempotent per context — repeated calls share one init.
      const { hostGroupId } = await wam.ensureWamHost(rawContext);
      const clone = await wam.cloneInstanceInto(livePlugin, rawContext, hostGroupId);
      instances.push(createWamEffectInstance(clone));
    }
  } catch (err) {
    dispose();
    throw err;
  }
  return { instances, dispose };
}

/** Wire from → instances (in order) → to via Tone's native↔Tone bridging connect(). */
export function connectOfflineChain(
  from: ToneAudioNode | AudioNode,
  instances: EffectInstance[],
  to: ToneAudioNode | AudioNode
): void {
  let current: ToneAudioNode | AudioNode = from;
  for (const inst of instances) {
    connect(current, inst.effect);
    current = inst.effect;
  }
  connect(current, to);
}
