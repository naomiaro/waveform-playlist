// A precompiled Faust effect as a dawcore custom effect.
//
// `tremolo.dsp` was compiled ahead of time with faustwasm's CLI:
//
//   npx faust2wasm-ts tremolo.dsp compiled/worklet
//
// which wrote `dsp-module.wasm`, `dsp-meta.json` and a copy of the faustwasm
// runtime (`faustwasm/index.js`). Nothing is compiled in the browser, and
// @dawcore/faust is not involved.
import { registerEffect } from '@dawcore/components';

/**
 * Register the effect type. `baseUrl` is where the compiled folder is served
 * — as static files, not through your bundler (see the guide: the faustwasm
 * runtime must not be minified).
 */
export async function registerFaustTremolo(baseUrl) {
  // Runtime URL import: both ignore-comments keep Vite and webpack from
  // trying to bundle it.
  const faustwasm = await import(
    /* webpackIgnore: true */ /* @vite-ignore */ baseUrl + 'faustwasm/index.js'
  );
  const meta = await (await fetch(baseUrl + 'dsp-meta.json')).json();
  const module = await WebAssembly.compileStreaming(fetch(baseUrl + 'dsp-module.wasm'));

  // What faustwasm calls a "factory": the compiled DSP plus its description.
  const factory = { module, json: JSON.stringify(meta), soundfiles: {} };
  const processorName = 'faust-tremolo';
  const generator = new faustwasm.FaustMonoDspGenerator();
  // 8 bytes per sample if the DSP was compiled with -double, else 4.
  const sampleSize = meta.compile_options.includes('-double') ? 8 : 4;

  registerEffect('faust-tremolo', {
    label: 'Tremolo (Faust, precompiled)',
    category: 'modulation',
    defaults: { rate: 5, depth: 0.5 },
    params: {
      rate: { min: 0.1, max: 20, step: 0.01, unit: 'Hz' },
      depth: { min: 0, max: 1, step: 0.01 },
    },

    // Runs once per AudioContext — the live one, and the OfflineAudioContext
    // that exportAudio() creates. createNode() registers the processor on that
    // context; the node it returns is not needed.
    prepare: async (ctx) => {
      const node = await generator.createNode(
        ctx,
        processorName,
        factory,
        false,
        512,
        processorName
      );
      node.destroy();
    },

    // Synchronous: the processor is already registered on `ctx`.
    create: (ctx) => {
      const node = new faustwasm.FaustMonoAudioWorkletNode(ctx, {
        processorOptions: { name: processorName, factory, sampleSize },
      });
      return {
        input: node,
        output: node,
        // Faust parameters are addressed by path: /<declared name>/<label>.
        applyParams: (params) => {
          if (params.rate !== undefined) node.setParamValue('/Tremolo/rate', params.rate);
          if (params.depth !== undefined) node.setParamValue('/Tremolo/depth', params.depth);
        },
        dispose: () => {
          node.destroy();
          node.disconnect();
        },
      };
    },
  });
}
