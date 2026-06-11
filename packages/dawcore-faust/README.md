# @dawcore/faust

In-browser [Faust](https://faust.grame.fr/) DSP compilation to [WAM 2.0](https://github.com/webaudiomodules) plugins for the dawcore family. Write a filter in a few lines of Faust, compile it in the browser, and hear it instantly — no toolchain, no build step, no hosting.

This package is framework-agnostic (no Lit, no React). `@dawcore/components` consumes it as an **optional peer dependency** — `<daw-track>.addFaustEffect()` dynamic-imports it on first use, so consumers who never compile Faust load **zero compiler bytes** (the Faust compiler is ~2.5 MB gzipped of WebAssembly, bundled inside [`@shren/faust2wam`](https://www.npmjs.com/package/@shren/faust2wam)).

## Installation

```bash
npm install @dawcore/faust
```

That's the only install — `@shren/faust2wam` (the compiler) is a regular dependency of this package, so your package manager pulls it in automatically.

`@dawcore/components` declares this package as an *optional* peer dependency, so add it to your own dependencies (as above, alongside `@dawcore/wam`) to enable `addFaustEffect` on `<daw-editor>` and `<daw-track>`.

## Using with `@dawcore/components`

Install this package next to `@dawcore/components` and use `addFaustEffect` on `<daw-editor>` (master chain) or `<daw-track>` (per-track chain):

```javascript
const track = document.querySelector('daw-track');

// Track chains are stereo — duplicate mono filters across both channels.
const dsp = `
import("stdfaust.lib");
cutoff = hslider("cutoff", 1000, 20, 20000, 1);
process = fi.lowpass(2, cutoff), fi.lowpass(2, cutoff);
`;

// Compiles in the browser (the compiler loads lazily on the first call),
// then joins the chain as an ordinary WAM entry: bypass, move, remove, GUIs,
// parameter edits, and the daw-effect-* events all work.
const effectId = await track.addFaustEffect(dsp, { name: 'My Lowpass' });

// Every hslider/vslider/checkbox in the DSP becomes a WAM parameter AND a
// control in the auto-generated GUI:
await track.openEffectGui(effectId, myPanelElement);
```

**Compile errors are user-facing** — they propagate unchanged with Faust's line/column diagnostics, and the chain is left untouched:

```text
My Lowpass:2 : ERROR : undefined symbol : lowpasss
```

**Persistence recompiles.** Faust entries serialize with their DSP source (`faustDsp`), name (`faustName`), and parameter state — no URL. `setEffectsState` (and `exportAudio`'s offline rendering) recompile the source on restore. Recompiling takes a moment; that's the accepted trade-off for fully self-contained sessions.

See [`examples/dawcore-wam/`](https://github.com/naomiaro/waveform-playlist/tree/main/examples/dawcore-wam) — the "Faust (compile in browser)" section is a runnable textarea-to-plugin demo (`pnpm example:dawcore-wam`).

## Standalone usage

```typescript
import { compileFaustToWam } from '@dawcore/faust';
import { ensureWamHost, createWamInstanceFromFactory } from '@dawcore/wam';

// First call dynamic-imports the compiler (cached; concurrent callers share
// one load, failed loads are evicted for retry). Faust errors reject with
// their diagnostics intact.
const compiled = await compileFaustToWam(dspCode, { name: 'My Lowpass' });
// compiled: { factory, name, dspCode }

// Instantiation reuses @dawcore/wam's validate/wrap pipeline — the generated
// class is factory-shaped (static createInstance), like any loaded WAM.
const { hostGroupId } = await ensureWamHost(audioContext);
const plugin = await createWamInstanceFromFactory(compiled.factory, audioContext, hostGroupId, {
  label: compiled.name,
});
```

Notes:

- The generated plugin is a standard WAM 2.0 effect — everything in [`@dawcore/wam`'s README](https://www.npmjs.com/package/@dawcore/wam) about Faust-generated plugins (flat parameter-map state, auto-generated GUI, descriptor shape) applies.
- Factory-created instances have no `url` and cannot be cloned with `cloneInstanceInto` — recompile the DSP on the target context instead (this is what dawcore's offline export does).
- Effects only — Faust polyphonic instruments are out of scope.
- Prefer ahead-of-time compilation? The `faust2wam` CLI (`npm i -D @shren/faust2wam`, then `npx faust2wam lowpass.dsp out/lowpass`) produces a static WAM bundle loadable via plain `addWamPlugin(url)` with zero compiler bytes shipped — see [`@dawcore/wam`'s "Custom effects with Faust"](https://www.npmjs.com/package/@dawcore/wam#custom-effects-with-faust).

## Under the hood: `@shren/faust2wam`

`compileFaustToWam` is a thin, cache-managed wrapper around [`@shren/faust2wam`](https://www.npmjs.com/package/@shren/faust2wam)'s browser API — its default export `generate(dspCode, name)`, which resolves to a WebAudioModule class. If you want the compiler without this wrapper, install it directly (`npm install @shren/faust2wam`) and call it yourself:

```typescript
// Lazy import — see the bundle note below.
const { default: generate } = await import('@shren/faust2wam');

const WamClass = await generate(dspCode, 'My Lowpass');
const wam = await WamClass.createInstance(hostGroupId, audioContext);
audioNodeChain.connect(wam.audioNode);
```

What this wrapper adds on top: input validation, a shared in-flight compiler load (concurrent first compiles share one download; failed loads are evicted for retry), and a factory shape check — while keeping Faust's compile diagnostics untouched.

**Bundle-size implication:** `@shren/faust2wam`'s `dist/index.js` is a single **~8 MB self-contained ESM bundle** (~2.5 MB gzipped) — the libfaust compiler WASM and the Faust standard libraries are inlined as base64 data URIs, so nothing is fetched from a CDN and no assets need hosting. Always load it through a **dynamic `import()`** so your bundler splits it into its own chunk that's only fetched when the user actually compiles Faust; a static top-level import lands all ~8 MB in your main bundle. `compileFaustToWam` does the lazy import for you — that chunk isolation is most of the reason this package exists.

## Examples & Documentation

- [`examples/dawcore-wam/`](https://github.com/naomiaro/waveform-playlist/tree/main/examples/dawcore-wam) — the "Faust (compile in browser)" section is a runnable textarea-to-plugin demo (`pnpm example:dawcore-wam`)
- Guides: [naomiaro.github.io/waveform-playlist](https://naomiaro.github.io/waveform-playlist/docs/web-components/getting-started)

## License

MIT
