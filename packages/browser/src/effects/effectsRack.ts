/**
 * One effects chain: the list the UI shows, the live instances, and the
 * wiring between two points of the audio graph. `useDynamicEffects` owns one
 * rack (the master chain) and `useTrackDynamicEffects` one per track.
 *
 * The list is published through a `ValueSource`, not held in React state:
 * a parameter change replaces the list, and with the list in the state of a
 * hook called at the root of a page every slider step re-rendered the page.
 * Only the component that draws the rack subscribes (`useActiveEffects`).
 */
import { connect, disconnect } from 'tone';
import type { ToneAudioNode } from 'tone';
import { isNativeGlobalContext, getGlobalAudioContext } from '@waveform-playlist/playout';
import {
  createValueSource,
  ensureEffectPrepared,
  getEffectDefinitions,
  type ValueSource,
  type ValueSourceHandle,
} from '@waveform-playlist/core';
import type { WamPluginInstance } from '@dawcore/wam'; // type-only — erased at runtime
import { getEffectDefinition, type EffectDefinition } from './effectDefinitions';
import { createEffectInstance, type EffectInstance } from './effectFactory';
import { loadWamModule } from './loadWam';
import { createWamEffectInstance, type WamEffectInstance } from './wamEffectFactory';
import { createCustomEffectInstance, toEffectDefinition } from './customEffectFactory';
import { buildOfflineChain, connectOfflineChain } from './offlineChain';
import { chainTopologyKey, isDisconnectBypassed } from './chainTopology';

export type EffectParameterValue = number | string | boolean;

export interface ActiveEffect {
  instanceId: string;
  effectId: string;
  /**
   * 'tone' = built-in Tone.js effect; 'wam' = hosted WAM plugin;
   * 'custom' = a type registered with `registerEffect()` from
   * `@waveform-playlist/core`.
   */
  kind: 'tone' | 'wam' | 'custom';
  /** Module URL for wam entries. */
  url?: string;
  definition: EffectDefinition;
  params: Record<string, EffectParameterValue>;
  bypassed: boolean;
  /**
   * The effect's wet/dry parameter, when it has one. Bypass sets it to 0 and
   * leaves the effect in the chain; an effect without one is bypassed by
   * disconnecting it.
   */
  wetParam?: string;
}

/** Wires an offline copy of the chain between two nodes; resolves with its cleanup. */
export type OfflineRackFunction = (
  from: ToneAudioNode,
  to: ToneAudioNode | AudioNode
) => Promise<() => void>;

const NATIVE_CONTEXT_HINT =
  'Call configureGlobalContext({ nativeAudioContext: true }) from ' +
  '@waveform-playlist/playout before any audio initialization.';

const NO_EFFECTS: ActiveEffect[] = [];

/** `wiredKey` while the graph is not known to match any list. No list has this key. */
const UNWIRED = '\u0000unwired';

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class EffectsRack {
  private readonly handle: ValueSourceHandle<ActiveEffect[]> = createValueSource(NO_EFFECTS);
  private readonly instances = new Map<string, EffectInstance>();
  private attachment: { from: ToneAudioNode; to: ToneAudioNode | AudioNode } | null = null;
  private wiredKey = '';
  /** Bumped by clear(): an add that was awaiting across it is dropped. */
  private generation = 0;

  /** The effects in chain order. A new array on every change. */
  get effects(): ValueSource<ActiveEffect[]> {
    return this.handle.source;
  }

  private list(): ActiveEffect[] {
    return this.handle.source.getSnapshot();
  }

  /**
   * Wire the graph for `next` if its topology differs, then publish it. If
   * the wiring throws (a node on another context, for instance) the previous
   * list is wired back and nothing is published, so the list always describes
   * what is connected.
   */
  private commit(next: ActiveEffect[]): void {
    if (chainTopologyKey(next) !== this.wiredKey) {
      const previous = this.list();
      try {
        this.wire(next, true);
      } catch (err) {
        try {
          this.wire(previous, true);
        } catch (restoreErr) {
          // wiredKey is UNWIRED now, so the next change wires from scratch.
          console.warn(
            '[waveform-playlist] Could not restore an effects chain after a failed change: ' +
              message(restoreErr)
          );
        }
        throw err;
      }
    }
    this.handle.publish(next);
  }

  private audibleInstances(effects: ActiveEffect[]): EffectInstance[] {
    return effects
      .filter((effect) => !isDisconnectBypassed(effect))
      .map((effect) => this.instances.get(effect.instanceId))
      .filter((instance): instance is EffectInstance => instance !== undefined);
  }

  /**
   * Connect from → effect 1 → … → to. `rewire` first cuts what was there:
   * `from`'s outgoing edges, and the output of EVERY instance, including the
   * ones a bypass has taken out of the chain (an effect that makes sound
   * with nothing connected to its input must fall silent as well).
   */
  private wire(effects: ActiveEffect[], rewire: boolean): void {
    const key = chainTopologyKey(effects);
    const attachment = this.attachment;
    if (!attachment) {
      this.wiredKey = key;
      return;
    }
    const { from, to } = attachment;
    // Until every connection below is made, the graph matches no list.
    this.wiredKey = UNWIRED;

    if (rewire) {
      try {
        from.disconnect();
      } catch (err) {
        console.warn('[waveform-playlist] Error disconnecting an effects chain: ' + message(err));
      }
    }
    this.instances.forEach((instance) => instance.disconnect());

    const chain = this.audibleInstances(effects);
    if (chain.length === 0) {
      from.connect(to);
    } else {
      let current: ToneAudioNode | AudioNode = from;
      for (const instance of chain) {
        connect(current, instance.input);
        current = instance.output;
      }
      connect(current, to);
    }
    this.wiredKey = key;
  }

  /**
   * Put the chain between two nodes of the live graph. Returns the function
   * that detaches it from `to`, for when that part of the graph is disposed.
   * A second attach replaces the first; the first one's detach then only
   * removes its own edges.
   */
  attach = (from: ToneAudioNode, to: ToneAudioNode | AudioNode): (() => void) => {
    this.attachment = { from, to };
    this.wire(this.list(), false);
    return () => {
      // Effect instances outlive the nodes they are attached to (a track is
      // rebuilt, its effects are not). Without this each rebuild would leave
      // one more edge into a dead node.
      this.instances.forEach((instance) => {
        try {
          disconnect(instance.output, to);
        } catch {
          // Expected for every instance but the tail: disconnecting an edge
          // that does not exist throws.
        }
      });
      if (this.attachment?.to === to) {
        this.attachment = null;
      }
    };
  };

  private append(instance: EffectInstance, entry: Omit<ActiveEffect, 'instanceId'>): string {
    this.instances.set(instance.instanceId, instance);
    try {
      this.commit([...this.list(), { ...entry, instanceId: instance.instanceId }]);
    } catch (err) {
      // Not in the list, so nothing else could ever remove or dispose it.
      this.instances.delete(instance.instanceId);
      instance.dispose();
      throw err;
    }
    return instance.instanceId;
  }

  /**
   * Add a built-in effect, or a type registered with `registerEffect()`, by
   * id. A built-in is in the list before this returns; a registered type is
   * added once its `prepare` hook has run on the live context. Resolves with
   * the new entry's instanceId; rejects for an unknown id.
   */
  add = async (effectId: string): Promise<string> => {
    const builtIn = getEffectDefinition(effectId);
    if (builtIn) {
      const params: Record<string, EffectParameterValue> = {};
      builtIn.parameters.forEach((parameter) => {
        params[parameter.name] = parameter.default;
      });
      const instance = createEffectInstance(builtIn, params);
      return this.append(instance, {
        effectId,
        kind: 'tone',
        definition: builtIn,
        params,
        bypassed: false,
        ...(instance.getParameter('wet') !== undefined ? { wetParam: 'wet' } : {}),
      });
    }

    // A built-in id was handled above: it wins over a registered type of the
    // same name.
    const registered = getEffectDefinitions().get(effectId);
    if (!registered) {
      throw new Error(
        '[waveform-playlist] Unknown effect "' +
          effectId +
          '". It is neither a built-in effect nor a type registered with registerEffect() ' +
          'from @waveform-playlist/core.'
      );
    }
    if (!isNativeGlobalContext()) {
      throw new Error(
        '[waveform-playlist] Custom effects require a native AudioContext. ' + NATIVE_CONTEXT_HINT
      );
    }
    const audioContext = getGlobalAudioContext();
    const generation = this.generation;
    await ensureEffectPrepared(effectId, audioContext);
    if (generation !== this.generation) {
      throw new Error(
        '[waveform-playlist] addEffect("' +
          effectId +
          '") aborted: the effects chain was cleared or disposed before the effect was ready.'
      );
    }
    // The type may have been registered again during the await. The instance
    // is created from the current definition, so the entry must describe it.
    const definition = getEffectDefinitions().get(effectId);
    if (!definition) {
      throw new Error(
        '[waveform-playlist] addEffect("' +
          effectId +
          '") aborted: the effect type was unregistered before the effect was ready.'
      );
    }
    const instance = createCustomEffectInstance(effectId, audioContext, definition.defaults);
    return this.append(instance, {
      effectId,
      kind: 'custom',
      definition: toEffectDefinition(effectId, definition),
      params: { ...definition.defaults },
      bypassed: false,
      ...(definition.wetParam !== undefined ? { wetParam: definition.wetParam } : {}),
    });
  };

  /** Host a WAM plugin from a module URL and append it. Requires native-context mode. */
  addWam = async (url: string, initialState?: unknown): Promise<string> => {
    if (!isNativeGlobalContext()) {
      throw new Error(
        '[waveform-playlist] WAM plugins require a native AudioContext. ' + NATIVE_CONTEXT_HINT
      );
    }
    const generation = this.generation;
    const wam = await loadWamModule();
    const audioContext = getGlobalAudioContext();
    const { hostGroupId } = await wam.ensureWamHost(audioContext);
    const plugin = await wam.createWamInstance(
      url,
      audioContext,
      hostGroupId,
      initialState !== undefined ? { initialState } : undefined
    );
    if (generation !== this.generation) {
      try {
        plugin.destroy();
      } catch (err) {
        console.warn(
          '[waveform-playlist] Error destroying WAM plugin after unmount: ' + message(err)
        );
      }
      throw new Error(
        '[waveform-playlist] addWamEffect aborted: the effects chain was cleared or disposed (hook unmounted) before the plugin finished loading.'
      );
    }
    const instance = createWamEffectInstance(plugin);
    return this.append(instance, {
      effectId: instance.id,
      kind: 'wam',
      url,
      definition: {
        id: instance.id,
        name: plugin.descriptor?.name ?? url,
        category: 'wam',
        description: 'WAM plugin',
        parameters: [],
      },
      params: {},
      bypassed: false,
    });
  };

  /** Live plugin handle for a hosted WAM entry (for GUI mounting via WamEffectGui). */
  getWamPlugin = (instanceId: string): WamPluginInstance | undefined => {
    const instance = this.instances.get(instanceId) as WamEffectInstance | undefined;
    return instance?.kind === 'wam' ? instance.plugin : undefined;
  };

  remove = (instanceId: string): void => {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.dispose();
      this.instances.delete(instanceId);
    }
    const next = this.list().filter((effect) => effect.instanceId !== instanceId);
    if (next.length !== this.list().length) this.commit(next);
  };

  /** Set a parameter on the live effect. Never rewires the chain. */
  updateParameter = (instanceId: string, name: string, value: EffectParameterValue): void => {
    const effect = this.list().find((entry) => entry.instanceId === instanceId);
    if (!effect) return;
    // A registered effect's parameters are numbers. Storing anything else
    // would show a value the effect is not using.
    if (effect.kind === 'custom' && typeof value !== 'number') return;
    // The wet level of an effect bypassed in place is stored, not applied:
    // applying it would make the bypassed effect audible.
    if (!(effect.bypassed && name === effect.wetParam)) {
      this.instances.get(instanceId)?.setParameter(name, value);
    }
    this.commit(
      this.list().map((entry) =>
        entry.instanceId === instanceId
          ? { ...entry, params: { ...entry.params, [name]: value } }
          : entry
      )
    );
  };

  toggleBypass = (instanceId: string): void => {
    const effect = this.list().find((entry) => entry.instanceId === instanceId);
    if (!effect) return;
    const bypassed = !effect.bypassed;
    if (effect.wetParam !== undefined) {
      const wet = effect.params[effect.wetParam];
      this.instances
        .get(instanceId)
        ?.setParameter(effect.wetParam, bypassed ? 0 : typeof wet === 'number' ? wet : 1);
    }
    // Without a wet parameter the bypass is a change of wiring, which
    // commit() picks up from the topology key.
    this.commit(
      this.list().map((entry) => (entry.instanceId === instanceId ? { ...entry, bypassed } : entry))
    );
  };

  reorder = (fromIndex: number, toIndex: number): void => {
    const current = this.list();
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      fromIndex >= current.length ||
      toIndex < 0 ||
      toIndex >= current.length
    ) {
      return;
    }
    const next = [...current];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    this.commit(next);
  };

  /**
   * Remove and dispose every effect. An add that is still waiting (a
   * registered effect's `prepare`, a WAM plugin loading) is dropped too: its
   * promise rejects and nothing is appended after the clear.
   */
  clear = (): void => {
    this.generation++;
    this.instances.forEach((instance) => instance.dispose());
    this.instances.clear();
    if (this.list().length > 0) this.commit(NO_EFFECTS);
  };

  /**
   * For the owner going away: the same as clear(). The list and the
   * instances go together, so a remount (StrictMode, an `<Activity>` shown
   * again) never finds entries whose instances are gone. The rack stays
   * usable.
   */
  dispose = (): void => {
    this.clear();
  };

  /**
   * Builds this chain again on an offline context, for WAV export, from the
   * chain as it is when called: built-ins are re-created, WAM plugins
   * re-instantiated with the live plugin's state, registered effects prepared
   * and created on the offline context. With no active effect it connects
   * `from` straight to `to`. It rejects rather than render without an effect
   * the live chain has. Resolves with the cleanup for the offline instances.
   */
  renderOffline: OfflineRackFunction = async (from, to) => {
    // Bypassed entries are left out offline whichever way they are bypassed.
    const entries = this.list().filter((effect) => !effect.bypassed);
    if (entries.some((effect) => effect.kind !== 'tone') && !isNativeGlobalContext()) {
      throw new Error(
        '[waveform-playlist] WAV export with WAM or custom effects requires a native AudioContext. ' +
          NATIVE_CONTEXT_HINT
      );
    }
    // Tone nodes inside the offline build are created on the current
    // (offline) global context; its rawContext hosts the native ones.
    const rawContext = from.context.rawContext as unknown as BaseAudioContext;
    const { instances, dispose } = await buildOfflineChain(entries, this.getWamPlugin, rawContext);
    connectOfflineChain(from, instances, to);
    return dispose;
  };
}
