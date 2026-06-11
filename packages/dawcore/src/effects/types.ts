/** Range/display metadata for one effect parameter. */
export interface EffectParamDef {
  min: number;
  max: number;
  step?: number;
  /** 's', 'ms', 'Hz', 'dB', '%' … */
  unit?: string;
}

/**
 * A live, wired effect. `input`/`output` are the chain attachment points
 * (the same node for single-node effects). `applyParams` updates AudioParams
 * in place — the chain never rebuilds for parameter changes.
 */
export interface EffectInstance {
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
export interface EffectDefinition {
  label: string;
  category: string;
  defaults: Record<string, number>;
  params: Record<string, EffectParamDef>;
  /** Name of the wet/dry param, when the effect has one. Bypass zeroes it
   *  (storing the original); effects without one are bypassed by
   *  disconnection. */
  wetParam?: string;
  create: (audioContext: BaseAudioContext, params: Record<string, number>) => EffectInstance;
}

/**
 * What the chain controller stores per slot. Kind-agnostic: 'native' entries
 * come from the registry, 'wam' entries (future) wrap a WAM plugin's
 * audioNode — chain operations never branch on kind.
 */
export interface EffectChainItem {
  kind: string;
  type: string;
  instance: EffectInstance;
  params: Record<string, number>;
  wetParam?: string;
  /** Plugin source URL (kind 'wam'). */
  url?: string;
  /** Human-readable name (e.g. a WAM descriptor's name). */
  label?: string;
  /** Why this entry is a non-functional placeholder (e.g. plugin URL unreachable on restore). */
  error?: string;
  /** Placeholder restore data: what the entry SHOULD be once its plugin loads. */
  placeholder?: { state?: unknown; bypassed: boolean };
}

/** Public, serializable view of one chain entry. */
export interface EffectState {
  id: string;
  kind: string;
  type: string;
  params: Record<string, number>;
  bypassed: boolean;
  url?: string;
  label?: string;
  error?: string;
}

/** Persisted form of a chain — see README for the consumer contract. */
export type SerializedEffectEntry =
  | { kind: 'native'; type: string; params: Record<string, number>; bypassed: boolean }
  | { kind: 'wam'; url: string; bypassed: boolean; state?: unknown };

/** Result of creating an effect via the registry. */
export interface CreatedEffect {
  instance: EffectInstance;
  params: Record<string, number>;
  wetParam?: string;
}
