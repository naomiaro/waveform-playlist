/**
 * Effects registered with `registerEffect()` from `@waveform-playlist/core`
 * (an AudioWorklet, or any chain of native nodes), hosted in the Tone.js
 * chain. The nodes are native, so linking goes through Tone's
 * connect()/disconnect() helpers, and the caller must be in native-context
 * mode (see EffectsRack.add).
 */
import { connect, disconnect } from 'tone';
import type { InputNode } from 'tone';
import { isNativeGlobalContext } from '@waveform-playlist/playout';
import {
  createEffectInstance as createRegisteredEffect,
  getEffectDefinitions,
  type NativeEffectDefinition,
  type NativeEffectInstance,
} from '@waveform-playlist/core';
import {
  effectDefinitions,
  getEffectDefinition,
  type EffectDefinition,
  type EffectParameter,
} from './effectDefinitions';
import type { EffectInstance } from './effectFactory';

export interface CustomEffectInstance extends EffectInstance {
  kind: 'custom';
  /** What the registered definition's `create` returned. */
  native: NativeEffectInstance;
}

const converted = new WeakMap<NativeEffectDefinition, Map<string, EffectDefinition>>();

/** The hooks' view of a registered definition. The same object is returned
 *  for the same registration. */
export function toEffectDefinition(
  type: string,
  definition: NativeEffectDefinition
): EffectDefinition {
  const byType = converted.get(definition) ?? new Map<string, EffectDefinition>();
  converted.set(definition, byType);
  const existing = byType.get(type);
  if (existing) return existing;

  const parameters: EffectParameter[] = Object.entries(definition.params).map(([name, param]) => ({
    name,
    label: param.label ?? name,
    type: 'number',
    min: param.min,
    max: param.max,
    ...(param.step !== undefined ? { step: param.step } : {}),
    ...(param.unit !== undefined ? { unit: param.unit } : {}),
    default: definition.defaults[name] ?? param.min,
  }));
  const result: EffectDefinition = {
    id: type,
    name: definition.label,
    category: definition.category,
    description: '',
    parameters,
  };
  byType.set(type, result);
  return result;
}

let availableCache: { custom: EffectDefinition[]; list: EffectDefinition[] } | null = null;

/**
 * The effects that can be added right now: the built-in effects, followed by
 * every registered custom effect when the app is in native-context mode (a
 * registered effect cannot be added without it). Returns the same array until
 * that set changes, so it is safe to read during render. It is a read, not a
 * subscription: a type registered later appears the next time this is called.
 */
export function getAvailableEffects(): EffectDefinition[] {
  if (!isNativeGlobalContext()) return effectDefinitions;
  const custom: EffectDefinition[] = [];
  getEffectDefinitions().forEach((definition, type) => {
    if (!getEffectDefinition(type)) custom.push(toEffectDefinition(type, definition));
  });
  if (custom.length === 0) return effectDefinitions;
  const cached = availableCache;
  if (
    cached &&
    cached.custom.length === custom.length &&
    cached.custom.every((definition, i) => definition === custom[i])
  ) {
    return cached.list;
  }
  const list = [...effectDefinitions, ...custom];
  availableCache = { custom, list };
  return list;
}

/** Only numbers reach a registered effect: its parameters are numeric. */
export function numericParams(
  params: Record<string, number | string | boolean>
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [name, value] of Object.entries(params)) {
    if (typeof value === 'number') result[name] = value;
  }
  return result;
}

let customInstanceCounter = 0;

/**
 * Create a registered effect on `audioContext`. The type's `prepare` hook
 * must already have run on that context (`ensureEffectPrepared`).
 */
export function createCustomEffectInstance(
  type: string,
  audioContext: BaseAudioContext,
  params: Record<string, number | string | boolean> = {}
): CustomEffectInstance {
  const created = createRegisteredEffect(type, audioContext, numericParams(params));
  const native = created.instance;
  const current: Record<string, number> = { ...created.params };
  const instanceId = 'custom_' + ++customInstanceCounter;

  const disconnectOutput = (): void => {
    try {
      disconnect(native.output);
    } catch (err) {
      console.warn(
        '[waveform-playlist] Error disconnecting effect "' +
          type +
          '" (' +
          instanceId +
          '): ' +
          (err instanceof Error ? err.message : String(err))
      );
    }
  };

  return {
    kind: 'custom',
    native,
    input: native.input,
    output: native.output,
    id: type,
    instanceId,
    dispose: () => {
      disconnectOutput();
      try {
        native.dispose?.();
      } catch (err) {
        console.warn(
          '[waveform-playlist] Error disposing effect "' +
            type +
            '" (' +
            instanceId +
            '): ' +
            (err instanceof Error ? err.message : String(err))
        );
      }
    },
    setParameter: (name, value) => {
      if (typeof value !== 'number') return;
      current[name] = value;
      native.applyParams({ [name]: value });
    },
    getParameter: (name) => current[name],
    connect: (destination: InputNode) => connect(native.output, destination),
    disconnect: disconnectOutput,
  };
}
