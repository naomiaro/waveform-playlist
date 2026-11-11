import type { NativeEffectInstance } from '@waveform-playlist/core';

/**
 * What the chain controller stores per slot. Kind-agnostic: 'native' entries
 * come from the registry, 'wam' entries (future) wrap a WAM plugin's
 * audioNode — chain operations never branch on kind.
 */
export interface EffectChainItem {
  kind: string;
  type: string;
  instance: NativeEffectInstance;
  params: Record<string, number>;
  wetParam?: string;
  /** Plugin source URL (kind 'wam', url-loaded). */
  url?: string;
  /** Compiled-from-source marker (kind 'wam', Faust): persistence recompiles
   *  the DSP instead of fetching a URL. */
  source?: { faust: string };
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
  /** Present on Faust entries: the DSP source this effect was compiled from. */
  source?: { faust: string };
  label?: string;
  error?: string;
}

/** Persisted form of a chain — see README for the consumer contract. */
export type SerializedEffectEntry =
  | {
      kind: 'native';
      type: string;
      params: Record<string, number>;
      bypassed: boolean;
      /** Present when the live entry was a failed-plugin placeholder (silent
       *  passthrough). Offline export skips these for parity with live
       *  playback; restore ignores the flag and retries normally. */
      placeholder?: true;
    }
  | {
      kind: 'wam';
      /** Module URL for url-loaded plugins. Absent for Faust entries. */
      url?: string;
      bypassed: boolean;
      state?: unknown;
      /** Faust DSP source — restore recompiles in-browser via @dawcore/faust
       *  instead of fetching a URL. */
      faustDsp?: string;
      /** Name the Faust entry was compiled under (restores the same label). */
      faustName?: string;
      /** Present when the live entry was a failed-plugin placeholder (silent
       *  passthrough). Offline export skips these for parity with live
       *  playback; restore ignores the flag and retries the URL/DSP. */
      placeholder?: true;
    };
