const PREFIX = '[waveform-playlist] ';

/** Injectable for tests — production dynamically imports @shren/faust2wam. */
export type FaustModuleImport = () => Promise<unknown>;

/**
 * faust2wam's generate(): compiles Faust DSP source and resolves to a
 * WebAudioModule class. Typed structurally so the alpha-versioned upstream
 * typings never leak into this package's public surface.
 */
type FaustGenerateFn = (code: string, name?: string) => Promise<unknown>;

/**
 * The generated WebAudioModule class, viewed as a factory — the same shape
 * @dawcore/wam's `WamFactory` expects, so instantiation goes through
 * `createWamInstanceFromFactory` with no Faust-specific handling.
 */
export interface FaustWamFactory {
  createInstance(hostGroupId: string, audioContext: BaseAudioContext): Promise<unknown>;
}

/** Result of an in-browser Faust compile. */
export interface CompiledFaustWam {
  /** The generated WebAudioModule class. Instantiate it via @dawcore/wam's
   *  `createWamInstanceFromFactory(compiled.factory, ctx, hostGroupId)`. */
  factory: FaustWamFactory;
  /** The name the WAM was compiled under (its descriptor name). */
  name: string;
  /** The Faust DSP source this factory was compiled from. */
  dspCode: string;
}

export interface CompileFaustOptions {
  /** Plugin name baked into the generated WAM's descriptor. Default: 'FaustDSP'. */
  name?: string;
  /** Injectable module loader for tests — never vi.mock dynamic imports. */
  importFn?: FaustModuleImport;
}

const DEFAULT_NAME = 'FaustDSP';

const defaultImport: FaustModuleImport = () => import('@shren/faust2wam');

/**
 * Cached in-flight load of the compiler module (the ~MBs of libfaust WASM
 * ship inside it) — concurrent first compiles share one load; a failed load
 * is evicted so a later call retries. Same idempotency pattern as
 * @dawcore/wam's ensureWamHost. Keyed by importFn so test injections don't
 * cross-contaminate the production cache.
 */
let generateCache = new Map<FaustModuleImport, Promise<FaustGenerateFn>>();

function loadGenerate(importFn: FaustModuleImport): Promise<FaustGenerateFn> {
  const cached = generateCache.get(importFn);
  if (cached) {
    return cached;
  }

  const pending = importFn()
    .then((mod) => {
      const candidate = (mod as { default?: unknown } | null | undefined)?.default;
      if (typeof candidate !== 'function') {
        throw new Error(
          PREFIX +
            'compileFaustToWam: @shren/faust2wam has no callable default export — expected its generate() function. Check the installed package version.'
        );
      }
      return candidate as FaustGenerateFn;
    })
    .catch((err: unknown) => {
      // Evict so a later call can retry instead of replaying this failure.
      generateCache.delete(importFn);
      throw err;
    });

  generateCache.set(importFn, pending);
  return pending;
}

/**
 * Compile Faust DSP source to a WAM 2.0 plugin class, in the browser.
 *
 * The compiler (libfaust WASM, bundled inside @shren/faust2wam) is
 * dynamically imported on the first call and cached — consumers that never
 * compile Faust load zero compiler bytes.
 *
 * Faust compile errors are propagated UNCHANGED: their messages carry the
 * line/column diagnostics the user needs to fix their DSP source.
 */
export async function compileFaustToWam(
  dspCode: string,
  options: CompileFaustOptions = {}
): Promise<CompiledFaustWam> {
  if (typeof dspCode !== 'string' || dspCode.trim().length === 0) {
    throw new Error(PREFIX + 'compileFaustToWam: dspCode must be a non-empty string');
  }
  if (options.name !== undefined && typeof options.name !== 'string') {
    throw new Error(PREFIX + 'compileFaustToWam: name must be a string when provided');
  }
  const name = options.name ?? DEFAULT_NAME;

  const generate = await loadGenerate(options.importFn ?? defaultImport);
  // Faust errors (with their line/column diagnostics) propagate as-is.
  const factory = await generate(dspCode, name);

  const isFactoryShaped =
    factory !== null &&
    (typeof factory === 'function' || typeof factory === 'object') &&
    typeof (factory as { createInstance?: unknown }).createInstance === 'function';
  if (!isFactoryShaped) {
    throw new Error(
      PREFIX +
        'compileFaustToWam: faust2wam generate() did not return a WebAudioModule class with a static createInstance() — got ' +
        String(factory)
    );
  }

  return { factory: factory as FaustWamFactory, name, dspCode };
}

/** Test-only: drop the cached compiler module loads. */
export function _resetFaustCompilerCacheForTests(): void {
  generateCache = new Map();
}
