# Precompiled Faust demo

A Faust effect compiled ahead of time and loaded into `<daw-editor>` — no Faust compiler in the browser and no `@dawcore/faust`. Guide: [Precompiled Faust Effects](https://naomiaro.github.io/waveform-playlist/docs/faust-effects).

```bash
pnpm example:dawcore-wam    # open /faust-precompiled.html — native transport
pnpm example:dawcore-tone   # open /faust-precompiled.html — Tone.js adapter
pnpm example:faust:compile  # recompile after editing tremolo.dsp
```

| File | Purpose |
| --- | --- |
| `tremolo.dsp` | The effect's Faust source |
| `compile.mjs` | Runs `faust2wasm` (AudioWorklet target) and `faust2wam` (WAM target) into `compiled/`, and removes faust-ui from the WAM output. `--fixtures` regenerates `website/static/faust-wams/` |
| `faust-tremolo-effect.js` | Registers the AudioWorklet build with `registerEffect()` and a `prepare` hook |
| `demo.js` | Page logic shared by the two demo pages |
| `vite-plugin.mjs` | Serves `compiled/` at `/faust-compiled/` as static files (never bundled), compiling first if needed |

`compiled/` is generated and git-ignored. It contains the faustwasm runtime (LGPL) and, for the WAM target, faust2wam's plugin entry (LGPL-3.0) and the WAM SDK (MIT). faust-ui (GPL-3.0-or-later) is removed by the script.
