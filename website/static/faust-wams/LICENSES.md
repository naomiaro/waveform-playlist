# Bundled Faust WAM fixtures — licensing

These plugin bundles were generated ahead of time with [faust2wam](https://github.com/Fr0stbyteR/faust2wam) from the `.dsp` source in each directory, by `examples/faust-precompiled/compile.mjs --fixtures`. They are example and test fixtures.

**They are not all MIT.** An earlier version of this file described the vendored runtimes as MIT; that was wrong. What each bundle contains, and under which licence:

| Files | Origin | Licence |
| --- | --- | --- |
| `<name>.dsp`, `dsp-module.wasm`, `dsp-meta.json` | The effect itself: Faust DSP source in this repository, compiled with the Faust compiler. Uses the Faust standard libraries (`filters.lib`, `demos.lib`, `maths.lib`, and others listed in `dsp-meta.json`), each under its own terms (MIT-style STK-4.3, MIT, LGPL with the Faust exception that allows distributing compiled output under any licence). | Source: MIT (this repository). Library terms: see `dsp-meta.json` |
| `faustwasm/index.js` | The runtime of [`@grame/faustwasm`](https://github.com/grame-cncm/faustwasm) (GRAME). Creates the audio node from the compiled module. | **LGPL** (its `COPYING.txt` grants LGPL 2.1 or later; `package.json` declares LGPL-3.0 at the version used) |
| `index.js`, `descriptor.json` | Generated from faust2wam's templates ([`@shren/faust2wam`](https://github.com/Fr0stbyteR/faust2wam)), with the GUI hookup removed. | **LGPL-3.0** |
| `sdk/index.js`, `sdk-parammgr/index.js` | [`@webaudiomodules/sdk`](https://github.com/webaudiomodules/sdk) and `sdk-parammgr`. | MIT |

**Not included: `faust-ui`.** faust2wam normally also vendors [`faust-ui`](https://github.com/grame-cncm/faust-ui) for the plugin's own GUI. faust-ui is **GPL-3.0-or-later**, so the compile script removes it (`stripFaustUi`). These plugins therefore have no GUI of their own; hosts show their generic parameter panel instead.

The LGPL files are kept as separate files rather than merged into an application bundle, so they can be replaced with another build of the same library. Only `index.js` is modified from what faust2wam generates (the GUI hookup is removed, as noted in the table); `faustwasm/index.js` is unmodified.

## Licence texts and source

The licence texts for the LGPL files are in [`licenses/`](./licenses/):

- `licenses/faustwasm-COPYING.txt` — the `COPYING.txt` shipped in `@grame/faustwasm` (its copyright notice and the LGPL 2.1 text), copied unchanged. Applies to each `faustwasm/index.js`.
- `licenses/LGPL-3.0.txt` — the GNU Lesser General Public License, version 3. Applies to each plugin's `index.js` and `descriptor.json` (faust2wam's templates).
- `licenses/GPL-3.0.txt` — the GNU General Public License, version 3. Included because the LGPL-3.0 is written as additional permissions on top of it and refers to it. **No GPL-licensed code is in these folders.**

Source for the LGPL files:

- faustwasm: https://github.com/grame-cncm/faustwasm (the vendored file is the `dist` build of `@grame/faustwasm` 0.15.7).
- faust2wam: https://github.com/Fr0stbyteR/faust2wam (`@shren/faust2wam` 0.0.16; the plugin `index.js` is its `assets/wam2` template with the GUI import and `createGui()` removed by `examples/faust-precompiled/compile.mjs`).
 If you copy these bundles into your own project, the LGPL terms for those files come with them. This is a description of what is in the folder, not legal advice.
