# @dawcore/faust

In-browser [Faust](https://faust.grame.fr/) DSP compilation to [WAM 2.0](https://github.com/webaudiomodules) plugins for the dawcore family. Write a filter in a few lines of Faust, compile it in the browser, and hear it instantly — no toolchain, no build step, no hosting.

This package is framework-agnostic (no Lit, no React). `@dawcore/components` consumes it as an **optional peer dependency** — `<daw-track>.addFaustEffect()` dynamic-imports it on first use, so consumers who never compile Faust load **zero compiler bytes** (the Faust compiler is ~2.5 MB gzipped of WebAssembly, bundled inside [`@shren/faust2wam`](https://github.com/webaudiomodules/faust2wam)).

## Installation

```bash
npm install @dawcore/faust
```

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

- The generated plugin is a standard WAM 2.0 effect — everything in [`@dawcore/wam`'s README](../dawcore-wam) about Faust-generated plugins (flat parameter-map state, auto-generated GUI, descriptor shape) applies.
- Factory-created instances have no `url` and cannot be cloned with `cloneInstanceInto` — recompile the DSP on the target context instead (this is what dawcore's offline export does).
- Effects only — Faust polyphonic instruments are out of scope.
- Prefer ahead-of-time compilation? The faust2wam CLI produces a static WAM bundle loadable via plain `addWamPlugin(url)` with zero compiler bytes shipped — see [`@dawcore/wam`'s "Custom effects with Faust"](../dawcore-wam#custom-effects-with-faust).
