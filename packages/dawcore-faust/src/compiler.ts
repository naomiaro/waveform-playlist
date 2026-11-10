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
  createInstance(
    hostGroupId: string,
    audioContext: BaseAudioContext,
    initialState?: unknown
  ): Promise<unknown>;
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

  return { factory: withMinificationHint(factory as FaustWamFactory), name, dspCode };
}

const UNREGISTERED_PROCESSOR = 'is not defined in AudioWorkletGlobalScope';

/**
 * faustwasm assembles its AudioWorklet processor source from
 * `Class.toString()` + `Class.name`. A bundler that mangles identifiers
 * (default `vite build`, esbuild, terser) leaves that text referring to
 * names that no longer exist, so the worklet module throws a ReferenceError
 * on load. `audioWorklet.addModule()` still RESOLVES, `registerProcessor`
 * never runs, and the only visible failure is `new AudioWorkletNode` saying
 * the node name is not defined (#658). `keepNames` does not help — the
 * references inside the stringified bodies are still mangled.
 *
 * That error names neither the cause nor the fix, so translate it. Every
 * other failure passes through untouched.
 */
function withMinificationHint(generated: FaustWamFactory): FaustWamFactory {
  return {
    createInstance: async (hostGroupId, audioContext, ...rest) => {
      try {
        // Called as a method: the generated class's static createInstance
        // relies on `this`.
        return await generated.createInstance(hostGroupId, audioContext, ...rest);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!message.includes(UNREGISTERED_PROCESSOR)) {
          throw err;
        }
        const explained = new Error(
          PREFIX +
            'the Faust AudioWorklet processor never registered. This is what happens when a ' +
            'bundler minifies the Faust compiler (@shren/faust2wam): its worklet code is built ' +
            'from Function.toString(), which identifier mangling breaks. Turn mangling off in ' +
            'your production build — Vite 8: build.rolldownOptions.output.minify = ' +
            '{ mangle: false }; Vite 7 and earlier: esbuild: { minifyIdentifiers: false } — ' +
            'see "Production builds" in the @dawcore/faust README. Original error: ' +
            message
        ) as Error & { cause?: unknown };
        explained.cause = err;
        throw explained;
      }
    },
  };
}

/** Test-only: drop the cached compiler module loads. */
export function _resetFaustCompilerCacheForTests(): void {
  generateCache = new Map();
}
