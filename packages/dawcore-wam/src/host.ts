import { initializeWamHost } from '@webaudiomodules/sdk';

export interface WamHostInfo {
  hostGroupId: string;
  hostGroupKey: string;
}

/**
 * Per-context host registry. Keyed by the context itself so realtime and
 * offline contexts each get their own plugin group. WeakMap so a discarded
 * context (e.g. a finished OfflineAudioContext) doesn't pin the entry.
 */
let hostCache = new WeakMap<BaseAudioContext, Promise<WamHostInfo>>();

function isOfflineContext(audioContext: BaseAudioContext): boolean {
  return 'startRendering' in audioContext;
}

/**
 * Initialize the WAM host environment on a context, once. Subsequent calls
 * for the same context (including concurrent ones) share the original
 * initialization and resolve to the same host group.
 *
 * Realtime contexts must be running — WAM host init loads an AudioWorklet
 * module, which requires a resumed context (first user gesture). Offline
 * contexts are allowed while 'suspended': they only start running inside
 * startRendering(), and host init must happen before that.
 */
export function ensureWamHost(audioContext: BaseAudioContext): Promise<WamHostInfo> {
  const cached = hostCache.get(audioContext);
  if (cached) {
    return cached;
  }

  if (audioContext.state === 'closed') {
    return Promise.reject(new Error('[waveform-playlist] ensureWamHost: AudioContext is closed'));
  }
  if (!isOfflineContext(audioContext) && audioContext.state !== 'running') {
    return Promise.reject(
      new Error(
        '[waveform-playlist] ensureWamHost: AudioContext is "' +
          audioContext.state +
          '" — resume it (requires a user gesture) before loading WAM plugins'
      )
    );
  }

  const pending = initializeWamHost(audioContext)
    .then(([hostGroupId, hostGroupKey]: [string, string]) => ({ hostGroupId, hostGroupKey }))
    .catch((err: unknown) => {
      // Evict so a later call can retry instead of replaying this failure.
      hostCache.delete(audioContext);
      throw err;
    });

  hostCache.set(audioContext, pending);
  return pending;
}

/** Test-only: drop all cached host initializations. */
export function _resetWamHostCacheForTests(): void {
  hostCache = new WeakMap();
}
