import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compileFaustToWam, _resetFaustCompilerCacheForTests } from '../src/compiler';

const LOWPASS_DSP =
  'import("stdfaust.lib");\n' +
  'cutoff = hslider("cutoff", 1000, 20, 20000, 1);\n' +
  'process = fi.lowpass(2, cutoff), fi.lowpass(2, cutoff);\n';

/** Mirrors @shren/faust2wam's generate(): resolves to a WebAudioModule class. */
function makeWamClass() {
  return class MockWam {
    static createInstance = vi.fn(async () => ({}));
  };
}

function makeGenerate(wamClass: unknown = makeWamClass()) {
  return vi.fn(async (_code: string, _name?: string) => wamClass);
}

function makeImportFn(generate: unknown) {
  return vi.fn(async () => ({ default: generate }));
}

beforeEach(() => {
  _resetFaustCompilerCacheForTests();
});

describe('compileFaustToWam', () => {
  it('compiles via the faust2wam generate() default export and returns the factory', async () => {
    const WamClass = makeWamClass();
    const generate = makeGenerate(WamClass);
    const importFn = makeImportFn(generate);

    const compiled = await compileFaustToWam(LOWPASS_DSP, { importFn });

    expect(generate).toHaveBeenCalledWith(LOWPASS_DSP, 'FaustDSP');
    expect(typeof compiled.factory.createInstance).toBe('function');
    expect(compiled.dspCode).toBe(LOWPASS_DSP);
    expect(compiled.name).toBe('FaustDSP');
  });

  it('forwards a custom name to generate() and exposes it on the result', async () => {
    const generate = makeGenerate();
    const importFn = makeImportFn(generate);

    const compiled = await compileFaustToWam(LOWPASS_DSP, { name: 'My Lowpass', importFn });

    expect(generate).toHaveBeenCalledWith(LOWPASS_DSP, 'My Lowpass');
    expect(compiled.name).toBe('My Lowpass');
  });

  it('loads the compiler module once — repeated compiles share the cached load', async () => {
    const generate = makeGenerate();
    const importFn = makeImportFn(generate);

    await compileFaustToWam(LOWPASS_DSP, { importFn });
    await compileFaustToWam(LOWPASS_DSP, { importFn });

    expect(importFn).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('concurrent first compiles share one in-flight module load', async () => {
    const generate = makeGenerate();
    const importFn = makeImportFn(generate);

    await Promise.all([
      compileFaustToWam(LOWPASS_DSP, { importFn }),
      compileFaustToWam(LOWPASS_DSP, { importFn }),
    ]);

    expect(importFn).toHaveBeenCalledTimes(1);
  });

  it('evicts a failed compiler load so a retry re-imports', async () => {
    const generate = makeGenerate();
    const importFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ default: generate });

    await expect(compileFaustToWam(LOWPASS_DSP, { importFn })).rejects.toThrow('network down');
    const compiled = await compileFaustToWam(LOWPASS_DSP, { importFn });

    expect(importFn).toHaveBeenCalledTimes(2);
    expect(compiled.dspCode).toBe(LOWPASS_DSP);
  });

  it('rejects a compiler module without a callable default export', async () => {
    const importFn = vi.fn(async () => ({ default: undefined }));

    await expect(compileFaustToWam(LOWPASS_DSP, { importFn })).rejects.toThrow(
      /\[waveform-playlist\][\s\S]*@shren\/faust2wam/
    );
  });

  it('propagates Faust compile errors unchanged — line/column diagnostics intact', async () => {
    const faustError = new Error(
      'lowpass.dsp : 2 : ERROR : undefined symbol : fi.lowpasss\n' +
        'lowpass.dsp : 2 : ERROR : in column 11'
    );
    const generate = vi.fn(async () => {
      throw faustError;
    });
    const importFn = makeImportFn(generate);

    // The exact Error instance, message untouched — these diagnostics are
    // user-facing (the user wrote the DSP).
    await expect(compileFaustToWam('process = fi.lowpasss(2);', { importFn })).rejects.toBe(
      faustError
    );
  });

  it('a Faust compile failure does not evict the loaded compiler module', async () => {
    const generate = vi
      .fn()
      .mockRejectedValueOnce(new Error('syntax error'))
      .mockResolvedValueOnce(makeWamClass());
    const importFn = makeImportFn(generate);

    await expect(compileFaustToWam('garbage', { importFn })).rejects.toThrow('syntax error');
    await compileFaustToWam(LOWPASS_DSP, { importFn });

    expect(importFn).toHaveBeenCalledTimes(1);
  });

  it('rejects a generate() result that is not factory-shaped (no createInstance)', async () => {
    const generate = vi.fn(async () => ({}));
    const importFn = makeImportFn(generate);

    await expect(compileFaustToWam(LOWPASS_DSP, { importFn })).rejects.toThrow(/createInstance/);
  });

  it('rejects empty or non-string DSP code without touching the compiler', async () => {
    const importFn = makeImportFn(makeGenerate());

    await expect(compileFaustToWam('', { importFn })).rejects.toThrow(/non-empty string/);
    await expect(compileFaustToWam('   \n', { importFn })).rejects.toThrow(/non-empty string/);
    await expect(compileFaustToWam(42 as unknown as string, { importFn })).rejects.toThrow(
      /non-empty string/
    );
    expect(importFn).not.toHaveBeenCalled();
  });

  it('rejects a non-string name option', async () => {
    const importFn = makeImportFn(makeGenerate());

    await expect(
      compileFaustToWam(LOWPASS_DSP, { name: 7 as unknown as string, importFn })
    ).rejects.toThrow(/name/);
    expect(importFn).not.toHaveBeenCalled();
  });
});

// #658: a bundler that mangles identifiers breaks the worklet processor
// source faustwasm assembles from Class.toString(). The worklet module
// throws, addModule() still resolves, and the first visible failure is an
// InvalidStateError from `new AudioWorkletNode` that names neither the
// cause nor the fix.
describe('compiled factory instantiation', () => {
  const ctx = {} as BaseAudioContext;

  function unregisteredProcessorError() {
    return new DOMException(
      "Failed to construct 'AudioWorkletNode': AudioWorkletNode cannot be created: " +
        "The node name 'fr.grame.faust.limiterFaust' is not defined in AudioWorkletGlobalScope.",
      'InvalidStateError'
    );
  }

  it('delegates createInstance to the generated class, preserving `this` and all arguments', async () => {
    const instance = { audioNode: {} };
    class GeneratedWam {
      static tag = 'generated';
      static async createInstance(this: typeof GeneratedWam, ...args: unknown[]) {
        return { instance, tag: this.tag, args };
      }
    }
    const compiled = await compileFaustToWam(LOWPASS_DSP, {
      importFn: makeImportFn(makeGenerate(GeneratedWam)),
    });
    const initialState = { cutoff: 500 };

    const result = await (
      compiled.factory.createInstance as (...args: unknown[]) => Promise<unknown>
    )('group-1', ctx, initialState);

    expect(result).toEqual({ instance, tag: 'generated', args: ['group-1', ctx, initialState] });
  });

  it('explains a never-registered worklet processor as a minification problem', async () => {
    const original = unregisteredProcessorError();
    const WamClass = { createInstance: vi.fn().mockRejectedValue(original) };
    const compiled = await compileFaustToWam(LOWPASS_DSP, {
      importFn: makeImportFn(makeGenerate(WamClass)),
    });

    const failure = await compiled.factory.createInstance('group-1', ctx).then(
      () => null,
      (err: unknown) => err as Error
    );

    expect(failure).toBeInstanceOf(Error);
    expect(failure!.message).toMatch(/^\[waveform-playlist\]/);
    // Names the cause, both fixes, and keeps the original text.
    expect(failure!.message).toContain('minif');
    expect(failure!.message).toContain('mangle: false');
    expect(failure!.message).toContain('minifyIdentifiers: false');
    expect(failure!.message).toContain('fr.grame.faust.limiterFaust');
    expect((failure as Error & { cause?: unknown }).cause).toBe(original);
  });

  it('passes any other instantiation failure through untouched', async () => {
    const original = new Error('WASM instantiate failed');
    const WamClass = { createInstance: vi.fn().mockRejectedValue(original) };
    const compiled = await compileFaustToWam(LOWPASS_DSP, {
      importFn: makeImportFn(makeGenerate(WamClass)),
    });

    await expect(compiled.factory.createInstance('group-1', ctx)).rejects.toBe(original);
  });

  it('does not rewrite an unrelated InvalidStateError', async () => {
    const original = new DOMException('The AudioContext was closed.', 'InvalidStateError');
    const WamClass = { createInstance: vi.fn().mockRejectedValue(original) };
    const compiled = await compileFaustToWam(LOWPASS_DSP, {
      importFn: makeImportFn(makeGenerate(WamClass)),
    });

    await expect(compiled.factory.createInstance('group-1', ctx)).rejects.toBe(original);
  });
});
