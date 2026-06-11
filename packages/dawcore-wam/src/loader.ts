const PREFIX = '[waveform-playlist] ';

/** Injectable for tests — production uses native dynamic import. */
export type WamModuleImport = (url: string) => Promise<unknown>;

/** Structural view of a WAM plugin's descriptor (subset we validate/expose). */
export interface WamPluginDescriptor {
  name: string;
  vendor?: string;
  version?: string;
  apiVersion: string;
  hasAudioInput: boolean;
  hasAudioOutput: boolean;
  thumbnail?: string;
  description?: string;
}

/** Structural view of a WamNode — the plugin's AudioNode plus the WAM API surface. */
export interface WamPluginAudioNode extends AudioNode {
  destroy(): void;
  getState(): Promise<unknown>;
  setState(state: unknown): Promise<void>;
  getParameterInfo(...parameterIds: string[]): Promise<unknown>;
  setParameterValues?(
    values: Record<string, { id: string; value: number; normalized: boolean }>
  ): Promise<void>;
  scheduleEvents?(...events: Array<{ type: string; time: number; data?: unknown }>): void;
}

interface WamModuleLike {
  descriptor: WamPluginDescriptor;
  audioNode: WamPluginAudioNode;
}

/** The module's default export: a WebAudioModule class (or object) with a createInstance factory. */
export interface WamFactory {
  createInstance(hostGroupId: string, audioContext: BaseAudioContext): Promise<WamModuleLike>;
}

/** A loaded, validated, live plugin wrapped for chain insertion. Headless — GUI handling is separate. */
export interface WamPluginInstance {
  url: string;
  descriptor: WamPluginDescriptor;
  audioNode: WamPluginAudioNode;
  getState(): Promise<unknown>;
  setState(state: unknown): Promise<void>;
  getParameterInfo(...parameterIds: string[]): Promise<unknown>;
  /** Tears down the plugin's AudioWorklet. Safe to call more than once. */
  destroy(): void;
}

export interface CreateWamInstanceOptions {
  initialState?: unknown;
  importFn?: WamModuleImport;
}

const defaultImport: WamModuleImport = (url) => import(/* @vite-ignore */ url);

let factoryCache = new Map<string, Promise<WamFactory>>();

/**
 * Load a WAM plugin module and resolve its factory (default export).
 * Cached per URL with a shared in-flight promise; failed loads are evicted
 * so a retry re-fetches instead of replaying the failure.
 */
export function loadWamFactory(
  url: string,
  importFn: WamModuleImport = defaultImport
): Promise<WamFactory> {
  const cached = factoryCache.get(url);
  if (cached) {
    return cached;
  }

  const pending = importFn(url)
    .then((mod) => {
      const candidate = (mod as { default?: unknown } | null | undefined)?.default;
      const isUsable =
        candidate !== null &&
        (typeof candidate === 'function' || typeof candidate === 'object') &&
        typeof (candidate as { createInstance?: unknown })?.createInstance === 'function';
      if (!isUsable) {
        throw new Error(
          PREFIX +
            'loadWamFactory: module at "' +
            url +
            '" has no usable default export. A WAM plugin module must default-export a WebAudioModule class with a static createInstance().'
        );
      }
      return candidate as WamFactory;
    })
    .catch((err: unknown) => {
      factoryCache.delete(url);
      throw err;
    });

  factoryCache.set(url, pending);
  return pending;
}

/**
 * Load (cached), instantiate, and validate a WAM plugin as an insert effect.
 * The descriptor is validated AFTER instantiation — many plugins only expose
 * it on the instance. Invalid plugins are destroyed before the error is thrown.
 */
export async function createWamInstance(
  url: string,
  audioContext: BaseAudioContext,
  hostGroupId: string,
  options: CreateWamInstanceOptions = {}
): Promise<WamPluginInstance> {
  const factory = await loadWamFactory(url, options.importFn);
  const wam = await factory.createInstance(hostGroupId, audioContext);

  try {
    validateEffectDescriptor(wam.descriptor, url);
    if (options.initialState !== undefined) {
      await wam.audioNode.setState(options.initialState);
    }
  } catch (err) {
    try {
      wam.audioNode.destroy();
    } catch (destroyErr) {
      // Never let teardown failure mask the original validation/state error.
      console.warn(
        PREFIX +
          'createWamInstance: cleanup after failure also failed for "' +
          url +
          '": ' +
          String(destroyErr)
      );
    }
    throw err;
  }

  let destroyed = false;
  return {
    url,
    descriptor: wam.descriptor,
    audioNode: wam.audioNode,
    getState: () => wam.audioNode.getState(),
    setState: (state: unknown) => wam.audioNode.setState(state),
    getParameterInfo: (...parameterIds: string[]) =>
      wam.audioNode.getParameterInfo(...parameterIds),
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      wam.audioNode.destroy();
    },
  };
}

function validateEffectDescriptor(descriptor: WamPluginDescriptor | undefined, url: string): void {
  const apiVersion = descriptor?.apiVersion;
  if (descriptor === undefined || typeof apiVersion !== 'string' || !apiVersion.startsWith('2.')) {
    throw new Error(
      PREFIX +
        'createWamInstance: plugin at "' +
        url +
        '" has a missing or incompatible descriptor apiVersion ("' +
        String(apiVersion) +
        '"). This host supports WAM 2.x.'
    );
  }
  if (!descriptor.hasAudioInput) {
    throw new Error(
      PREFIX +
        'createWamInstance: plugin at "' +
        url +
        '" has no audio input (hasAudioInput=false). Instrument-only plugins cannot be inserted into an effects chain.'
    );
  }
  if (!descriptor.hasAudioOutput) {
    throw new Error(
      PREFIX +
        'createWamInstance: plugin at "' +
        url +
        '" has no audio output (hasAudioOutput=false) and cannot be inserted into an effects chain.'
    );
  }
}

/** Test-only: drop all cached factory loads. */
export function _resetWamFactoryCacheForTests(): void {
  factoryCache = new Map();
}
