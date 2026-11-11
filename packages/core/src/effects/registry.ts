/**
 * The effect registry shared by `<daw-editor>` and the React effects hooks:
 * one `registerEffect()` call makes a custom effect (an AudioWorklet, or any
 * chain of native nodes) available to both. Nothing here creates an audio
 * node; definitions are handed the context they must build on.
 */

/** Range/display metadata for one effect parameter. */
export interface EffectParamDef {
  min: number;
  max: number;
  step?: number;
  /** 's', 'ms', 'Hz', 'dB', '%' … */
  unit?: string;
  /** Display name for a parameter panel. Defaults to the parameter's key. */
  label?: string;
}

/**
 * A live, wired effect. `input`/`output` are the chain attachment points
 * (the same node for single-node effects). `applyParams` updates AudioParams
 * in place — the chain never rebuilds for parameter changes.
 */
export interface NativeEffectInstance {
  input: AudioNode;
  output: AudioNode;
  applyParams: (params: Record<string, number>) => void;
  dispose?: () => void;
  /** Serializable snapshot of plugin-internal state (WAM getState). */
  getState?: () => Promise<unknown>;
  /** Builds the plugin's own GUI element (WAM createGui). GUI lifecycle is
   *  independent of audio — hiding/destroying a GUI never stops processing. */
  createGui?: () => Promise<HTMLElement>;
  /** Releases a GUI element previously built by `createGui` (WAM destroyGui). */
  destroyGui?: (gui: HTMLElement) => void;
  /** Parameter metadata for the generic fallback panel (WAM getParameterInfo). */
  getParameterInfo?: () => Promise<unknown>;
}

/** A registered effect type. `create` must work on any BaseAudioContext so
 *  the same definitions serve offline rendering. */
export interface NativeEffectDefinition {
  label: string;
  category: string;
  defaults: Record<string, number>;
  params: Record<string, EffectParamDef>;
  /** Name of the wet/dry param, when the effect has one. Bypass zeroes it
   *  (storing the original); effects without one are bypassed by
   *  disconnection. */
  wetParam?: string;
  /**
   * Optional async setup that must finish before `create` can run on a given
   * context — typically `audioContext.audioWorklet.addModule(url)` for an
   * AudioWorklet-backed effect. Worklet modules are context-bound, so this
   * runs once per context, including the OfflineAudioContext of every export
   * (which the consumer never sees). Hosts await it wherever they can: the
   * React hooks' `addEffect`, both surfaces' exports, `<daw-editor>`'s
   * `setEffectsState()`. `<daw-editor>`'s `addEffect()` is synchronous and
   * cannot — call `editor.prepareEffect(type)` first.
   *
   * Must be safe to run more than once on the same context: it runs again
   * after a failed attempt and when the type is re-registered.
   */
  prepare?: (audioContext: BaseAudioContext) => Promise<void>;
  create: (audioContext: BaseAudioContext, params: Record<string, number>) => NativeEffectInstance;
}

/** Result of creating an effect via the registry. */
export interface CreatedNativeEffect {
  instance: NativeEffectInstance;
  params: Record<string, number>;
  wetParam?: string;
}

interface PreparedRecord {
  /** The definition this preparation ran for — a re-registered type must
   *  prepare again with its new definition. */
  definition: NativeEffectDefinition;
  promise: Promise<void>;
  settled: boolean;
}

interface RegistryState {
  definitions: Map<string, NativeEffectDefinition>;
  /** Per-context preparation state. Weak: an OfflineAudioContext (one per
   *  export) must not be kept alive by the registry. */
  prepared: WeakMap<BaseAudioContext, Map<string, PreparedRecord>>;
}

/**
 * The registry lives on `globalThis`, not in this module. An app can end up
 * with two copies of this package (its own version, and the exact version a
 * dependent pins); with a module-level map an effect registered through one
 * copy would be unknown to hosts using the other.
 */
const REGISTRY_KEY = Symbol.for('@waveform-playlist/core/effect-registry');

function registryState(): RegistryState {
  const holder = globalThis as unknown as Record<symbol, RegistryState | undefined>;
  const existing = holder[REGISTRY_KEY];
  if (existing) return existing;
  const created: RegistryState = { definitions: new Map(), prepared: new WeakMap() };
  holder[REGISTRY_KEY] = created;
  return created;
}

const registry = registryState().definitions;
const prepared = registryState().prepared;

export function registerEffect(type: string, definition: NativeEffectDefinition): void {
  if (registry.has(type)) {
    console.warn(
      '[waveform-playlist] registerEffect: overwriting existing effect type "' + type + '"'
    );
  }
  registry.set(type, definition);
}

/** Remove a registered type. Returns whether it was registered. Effects
 *  already created from it keep working. */
export function unregisterEffect(type: string): boolean {
  return registry.delete(type);
}

/** A copy — mutating the returned map does not affect the registry. */
export function getEffectDefinitions(): Map<string, NativeEffectDefinition> {
  return new Map(registry);
}

/**
 * Run a registered effect's `prepare` hook for one context, once. Concurrent
 * and later calls share the same run; a failed run is forgotten so the next
 * call retries. Resolves immediately for definitions without a hook, and for
 * unknown types (creating the effect reports those).
 */
export function prepareEffect(type: string, audioContext: BaseAudioContext): Promise<void> {
  const definition = registry.get(type);
  if (!definition?.prepare) {
    return Promise.resolve();
  }
  const forContext = prepared.get(audioContext) ?? new Map<string, PreparedRecord>();
  prepared.set(audioContext, forContext);
  const existing = forContext.get(type);
  if (existing && existing.definition === definition) {
    return existing.promise;
  }

  const prepare = definition.prepare;
  const record: PreparedRecord = {
    definition,
    settled: false,
    // The async wrapper turns a synchronous throw into a rejection.
    promise: (async () => prepare(audioContext))().then(
      () => {
        record.settled = true;
      },
      (err: unknown) => {
        if (forContext.get(type) === record) {
          forContext.delete(type);
        }
        throw err;
      }
    ),
  };
  forContext.set(type, record);
  return record.promise;
}

function isPrepared(
  type: string,
  definition: NativeEffectDefinition,
  audioContext: BaseAudioContext
): boolean {
  const record = prepared.get(audioContext)?.get(type);
  return record !== undefined && record.definition === definition && record.settled;
}

/**
 * Whether `type` has a prepare hook that has not completed on this context
 * for its CURRENT definition. Synchronous, so async callers can skip the
 * await (and stay synchronous) for the common case of effects without one.
 */
export function needsPrepare(type: string, audioContext: BaseAudioContext): boolean {
  const definition = registry.get(type);
  return definition?.prepare !== undefined && !isPrepared(type, definition, audioContext);
}

/**
 * Await a type's preparation until it holds for the definition registered
 * NOW. A type re-registered while its old definition was preparing would
 * otherwise reach `create` unprepared. Rejects with the hook's own error.
 */
export async function ensureEffectPrepared(
  type: string,
  audioContext: BaseAudioContext
): Promise<void> {
  while (needsPrepare(type, audioContext)) {
    await prepareEffect(type, audioContext);
  }
}

export function createEffectInstance(
  type: string,
  audioContext: BaseAudioContext,
  params: Record<string, number> = {}
): CreatedNativeEffect {
  const definition = registry.get(type);
  if (!definition) {
    throw new Error(
      '[waveform-playlist] createEffectInstance: unknown effect type "' +
        type +
        '". Available types: ' +
        [...registry.keys()].join(', ')
    );
  }
  const merged = { ...definition.defaults, ...params };
  let instance: NativeEffectInstance;
  try {
    instance = definition.create(audioContext, merged);
  } catch (err) {
    if (!definition.prepare || isPrepared(type, definition, audioContext)) {
      throw err;
    }
    // The likeliest cause by far: an AudioWorklet module that was never
    // added to THIS context. Name the fix; keep the original message.
    const hinted = new Error(
      '[waveform-playlist] effect "' +
        type +
        '" has a prepare() step that has not completed on this audio context — ' +
        "await editor.prepareEffect('" +
        type +
        "') (or prepareEffect('" +
        type +
        "', audioContext)) before adding it. Original error: " +
        (err instanceof Error ? err.message : String(err))
    ) as Error & { cause?: unknown };
    // Keep the original (its name, type and stack) reachable: the hint is a
    // guess at the cause, and `create` may have thrown for a real bug.
    hinted.cause = err;
    throw hinted;
  }
  instance.applyParams(merged);
  return { instance, params: merged, wetParam: definition.wetParam };
}
