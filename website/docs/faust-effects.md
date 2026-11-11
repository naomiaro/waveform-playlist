---
sidebar_position: 6
description: "Compile a Faust effect ahead of time and load it into <daw-editor> or the React provider — as an AudioWorklet effect or a WAM plugin, with no compiler in the browser"
---

# Precompiled Faust Effects

[Faust](https://faust.grame.fr/) is a language for writing audio effects in a few lines. This guide compiles a Faust effect **at build time** and loads the result into Waveform Playlist, in the web components and in React.

## Compile ahead of time, or in the browser?

**If you know your effects when you build your app, compile them in advance.** That is this guide. You do not need `@dawcore/faust`.

`@dawcore/faust` (and `addFaustEffect()`) is only for **live compilation**: the DSP source is written or supplied while the app is running — a live-coding tool, a DSP playground, user-authored effects. It downloads and runs the Faust compiler in the browser.

| | Precompiled (this guide) | Live (`@dawcore/faust`) |
| --- | --- | --- |
| When the DSP is compiled | At build time, on your machine | In the user's browser |
| What the browser downloads | The effect (a few kB of WebAssembly) and a ~190 kB runtime | The Faust compiler: about 8 MB, 2.5 MB gzipped |
| Works in a minified production build | Yes, when the compiled folder is served as static files (see [Serve it as static files](#serve-it-as-static-files)) | Needs bundler configuration — see the `@dawcore/faust` README |
| GPL code shipped to the browser | None with the routes below | Yes (`faust-ui`, GPL-3.0-or-later) |
| LGPL code shipped to the browser | Yes (the faustwasm runtime) | Yes |

See [Licences](#licences) before you ship either one.

## 1. Write the effect

`tremolo.dsp` — a stereo tremolo with two controls:

```faust
declare name "Tremolo";
declare description "Stereo tremolo with rate and depth";

rate = hslider("rate[unit:Hz]", 5, 0.1, 20, 0.01);
depth = hslider("depth", 0.5, 0, 1, 0.01);

lfo = 0.5 * (1 + os.osc(rate));
gain = 1 - depth * lfo;

process = _ * gain, _ * gain;
import("stdfaust.lib");
```

Track chains are stereo, so give the effect two inputs and two outputs. Every `hslider`, `vslider`, `nentry`, `button` and `checkbox` becomes a parameter, addressed by a path built from the declared name and the label: `/Tremolo/rate`, `/Tremolo/depth`.

There are two ways to compile and load it. Both produce the same sound.

| | Route A: AudioWorklet effect | Route B: WAM plugin |
| --- | --- | --- |
| Compiler | `faust2wasm` from `@grame/faustwasm` | `faust2wam` from `@shren/faust2wam` |
| Loads with | `registerEffect()` + about 30 lines of glue | `addWamPlugin(url)` — no glue |
| Web components | Yes | Yes |
| React | Yes (`addEffect(id)`) | Yes (`addWamEffect(url)`) |
| Output size | about 200 kB | about 310 kB (after removing what you don't need) |
| Needs `@dawcore/wam` | No | Yes |
| GPL code in the output | No | Yes unless you remove `faust-ui` (shown below) |

## Route A — an AudioWorklet effect (web components and React)

### Compile

```bash
npm install -D @grame/faustwasm
mkdir -p public/faust   # the CLI does not create missing parent directories
npx faust2wasm-ts tremolo.dsp public/faust/tremolo
```

No Faust toolchain is needed; the compiler runs as WebAssembly inside Node. The folder it writes:

| File | What it is | Needed at runtime |
| --- | --- | --- |
| `dsp-module.wasm` | Your effect | Yes |
| `dsp-meta.json` | Its description: inputs, outputs, parameters | Yes |
| `faustwasm/index.js` | The faustwasm runtime (~190 kB) that turns the two files above into an audio node | Yes |
| `index.html`, `index.js`, `create-node.js` | A standalone test page | No — delete them |
| `*.map`, `*.d.ts` | Source maps and types | No |

### Register it

`registerEffect` comes from `@waveform-playlist/core`. One registration serves both `<daw-editor>` and the React effects hooks. Web-component users and React users both need `@waveform-playlist/core` as a direct dependency for this import:

```bash
npm install @waveform-playlist/core
```

```javascript
import { registerEffect } from '@waveform-playlist/core';

export async function registerFaustTremolo(baseUrl) {
  // A runtime URL import — the two comments stop Vite and webpack from
  // bundling the file. See "Serve it as static files".
  const faustwasm = await import(
    /* webpackIgnore: true */ /* @vite-ignore */ baseUrl + 'faustwasm/index.js'
  );
  const meta = await (await fetch(baseUrl + 'dsp-meta.json')).json();
  const module = await WebAssembly.compileStreaming(fetch(baseUrl + 'dsp-module.wasm'));

  const factory = { module, json: JSON.stringify(meta), soundfiles: {} };
  const processorName = 'faust-tremolo';
  const generator = new faustwasm.FaustMonoDspGenerator();
  const sampleSize = meta.compile_options.includes('-double') ? 8 : 4;

  registerEffect('faust-tremolo', {
    label: 'Tremolo (Faust, precompiled)',
    category: 'modulation',
    defaults: { rate: 5, depth: 0.5 },
    params: {
      rate: { min: 0.1, max: 20, step: 0.01, unit: 'Hz' },
      depth: { min: 0, max: 1, step: 0.01 },
    },

    // Once per AudioContext — the live one, and the offline one of every export.
    // createNode() registers the processor on that context.
    prepare: async (ctx) => {
      const node = await generator.createNode(ctx, processorName, factory, false, 512, processorName);
      node.destroy();
    },

    // Synchronous: the processor is already registered on ctx.
    create: (ctx) => {
      const node = new faustwasm.FaustMonoAudioWorkletNode(ctx, {
        processorOptions: { name: processorName, factory, sampleSize },
      });
      return {
        input: node,
        output: node,
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
```

### Load it — web components

```javascript
await registerFaustTremolo('/faust/tremolo/');

const editor = document.querySelector('daw-editor');
await editor.adapter.audioContext.resume(); // inside a click handler
await editor.prepareEffect('faust-tremolo'); // registers the processor on the live context

const track = document.querySelector('daw-track');
const id = track.addEffect('faust-tremolo', { depth: 0.8 }); // or editor.addEffect(...) for the master
track.setEffectParams(id, { rate: 8 });
track.setEffectBypassed(id, true);

const buffer = await editor.exportAudio(); // the effect renders offline too
```

From here it is an ordinary effect: reorder, bypass and remove work, `getEffectsState()` / `setEffectsState()` save and restore it, and `openEffectGui(id, container)` shows a parameter panel built from `params`.

`FaustMonoAudioWorkletNode` extends the browser's own `AudioWorkletNode`, so the editor must run on a native `AudioContext`. `NativePlayoutAdapter` always does. On the Tone.js adapter, call `configureGlobalContext({ nativeAudioContext: true })` from `@waveform-playlist/playout` before creating the adapter (not available in Firefox — see [WAM Plugins](./wam-plugins.md#browser-support-tone-backends)).

### Load it — React

```tsx
import { configureGlobalContext } from '@waveform-playlist/playout';
import { WaveformPlaylistProvider, Waveform } from '@waveform-playlist/browser';
import { useDynamicEffects } from '@waveform-playlist/browser/tone';
import { registerFaustTremolo } from './faust-tremolo-effect';

// Module scope, before anything creates the audio context: a worklet effect
// needs native AudioContext mode.
configureGlobalContext({ nativeAudioContext: true });

// Register once for the whole app. Adding the effect waits for this.
const registered = registerFaustTremolo('/faust/tremolo/');

function App({ tracks }) {
  const { addEffect, updateParameter, masterEffects } = useDynamicEffects();

  const addTremolo = async () => {
    try {
      await registered;
      // Runs the definition's prepare step on the audio context, then adds it.
      const id = await addEffect('faust-tremolo');
      updateParameter(id, 'depth', 0.8);
    } catch (err) {
      // The compiled files failed to load, or the app is not in native
      // AudioContext mode.
      console.error(err);
    }
  };

  return (
    <WaveformPlaylistProvider tracks={tracks} effects={masterEffects}>
      <button onClick={addTremolo}>Add tremolo</button>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

The registration is the same one the web components use. There is no separate prepare step: `addEffect` awaits the definition's `prepare` on the live context before it creates the effect, and rejects if the app is not in native AudioContext mode. Adding by id, as here, works as soon as the registration has finished. `availableEffects` is different: it is read when the component that called the hook renders, so if you list the effect in a picker, finish registering (`await registered`) before that component renders. For one track, use `addEffectToTrack(trackId, 'faust-tremolo')` from `useTrackDynamicEffects()`. A WAV export made with `useExportWav()` renders the effect: the offline effects function runs `prepare` on the export's offline context. See [Custom effects](./react/guides/effects.md#custom-effects) for the rack UI, bypass and export wiring.

## Route B — a WAM plugin (web components and React)

### Compile

```bash
npm install -D @shren/faust2wam
mkdir -p public/faust
npx faust2wam tremolo.dsp public/faust/tremolo-wam
```

The folder is a complete [WAM 2.0](https://www.webaudiomodules.com/) plugin:

| File or folder | What it is | Licence | Needed at runtime |
| --- | --- | --- | --- |
| `dsp-module.wasm`, `dsp-meta.json` | Your effect | Yours | Yes |
| `index.js`, `descriptor.json` | The plugin entry point, from faust2wam's templates | LGPL-3.0 | Yes |
| `faustwasm/` | The faustwasm runtime | LGPL | Yes |
| `sdk/`, `sdk-parammgr/` | The WAM SDK | MIT | Yes |
| `gui.js`, `faust-ui/` | The plugin's own GUI, drawn with faust-ui | **GPL-3.0-or-later** | Only for that GUI |
| `fftw/` | For `-fft` plugins only | — | No |
| `host/`, `*.map`, `*.d.ts` | Test page, source maps, types | — | No |

### Decide about faust-ui

The generated plugin's own GUI depends on `faust-ui`, which is GPL-3.0-or-later.

- **If your project is open source under a GPL-compatible licence**, keep the folder as it is. You get Faust's own knobs and sliders, and nothing more is needed.
- **If you cannot ship GPL code**, remove it. Delete `faust-ui/` and `gui.js`, and in `index.js` delete the line `import createElement from './gui.js';` and the `createGui()` method that calls it. The plugin then reports no GUI of its own, and Waveform Playlist shows its generic parameter panel instead (sliders built from the plugin's parameter list). The effect and its parameters are unchanged.

The repository's `examples/faust-precompiled/compile.mjs` does this removal as a script (`stripFaustUi`) and fails loudly if faust2wam's template ever changes shape.

### Load it — web components

```bash
npm install @dawcore/wam
```

```javascript
const track = document.querySelector('daw-track');
await editor.adapter.audioContext.resume(); // WAM hosting needs a running context

const id = await track.addWamPlugin(new URL('/faust/tremolo-wam/index.js', location.href).href);
track.setEffectParams(id, { '/Tremolo/depth': 0.8 }); // parameters use the Faust paths
await track.openEffectGui(id, document.querySelector('#fx-panel'));
```

### Load it — React

```tsx
import { useState } from 'react';
import { configureGlobalContext } from '@waveform-playlist/playout';
import { WaveformPlaylistProvider, Waveform } from '@waveform-playlist/browser';
import { useDynamicEffects, WamEffectGui } from '@waveform-playlist/browser/tone';

// Module scope, before anything creates the audio context.
configureGlobalContext({ nativeAudioContext: true });

function App({ tracks }) {
  // One call: its masterEffects goes to the provider, and the same object
  // adds the plugin and hands out its GUI handle.
  const { addWamEffect, getWamPlugin, masterEffects } = useDynamicEffects();
  const [instanceId, setInstanceId] = useState(null);

  const addTremolo = async () => {
    try {
      const url = new URL('/faust/tremolo-wam/index.js', location.href).href;
      setInstanceId(await addWamEffect(url));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <WaveformPlaylistProvider tracks={tracks} effects={masterEffects}>
      <button onClick={addTremolo}>Add tremolo</button>
      {/* The plugin's own GUI, or the generic parameter panel when it has none. */}
      {instanceId && <WamEffectGui plugin={getWamPlugin(instanceId)} />}
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

WAM hosting in React needs native AudioContext mode; see [WAM Plugins](./wam-plugins.md) for the setup, per-track effects and WAV export.

## Serve it as static files

Put the compiled folder where your static files go (`public/` in Vite, `static/` in Docusaurus, any static host) and load it **by URL**. Do not import it through your bundler.

The faustwasm runtime builds its audio processor at load time from the source text of its own classes. A bundler that minifies or renames that runtime breaks the generated processor — the same failure described for live compilation in the `@dawcore/faust` README. Served untouched and loaded by URL, the runtime is never rewritten, and your own code can be minified as usual.

Loading from another origin needs CORS headers (`Access-Control-Allow-Origin`) on the folder.

## Licences

This is a description of what you would be shipping, not legal advice.

- **Your effect** (`dsp-module.wasm`, `dsp-meta.json`) is yours. The Faust standard libraries it uses have their own terms, listed in `dsp-meta.json`; the library code that carries an LGPL licence comes with the Faust exception permitting compiled output under any licence.
- **The faustwasm runtime** (`faustwasm/index.js`, in both routes) is LGPL. Precompiling removes the multi-megabyte compiler, not this runtime. Keeping it as its own file, as the compilers write it, is what lets a user replace it with another build, which the LGPL requires. The LGPL's other conditions — shipping the licence text and notices, and making the library's source available — still apply to you, and the compiled folder does not include a licence file.
- **faust2wam's plugin files** (`index.js`, `descriptor.json`, route B) are LGPL-3.0.
- **faust-ui** (route B, unless removed) is GPL-3.0-or-later.
- **The WAM SDK** is MIT.
- **Live compilation** with `@dawcore/faust` loads `@shren/faust2wam`'s browser bundle, which contains the compiler, the faustwasm runtime and faust-ui — so it ships LGPL and GPL-3.0-or-later code to the browser.

`@dawcore/faust`, `@dawcore/wam` and `@dawcore/components` themselves are MIT and contain none of the above.

## Runnable demos

Both pages load the same precompiled tremolo both ways, with a parameter panel and an offline export:

```bash
pnpm example:dawcore-wam    # then open /faust-precompiled.html — native transport
pnpm example:dawcore-tone   # then open /faust-precompiled.html — Tone.js adapter
```

The demo's files are in [`examples/faust-precompiled/`](https://github.com/naomiaro/waveform-playlist/tree/main/examples/faust-precompiled): the `.dsp`, the compile script, the effect registration from route A, and a small Vite plugin that serves the compiled folder as static files in dev and copies it into a production build. `pnpm example:faust:compile` recompiles after you edit the `.dsp`.
