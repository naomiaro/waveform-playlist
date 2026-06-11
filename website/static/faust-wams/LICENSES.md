# Bundled Faust WAM fixtures — licensing

These plugin bundles were generated offline with [faust2wam](https://github.com/Fr0stbyteR/faust2wam) from the `.dsp` sources in each directory. They embed:

- **Faust standard library DSP code** — `filters.lib` (MIT-style STK-4.3), `demos.lib` effects `zita_light` / `flanger_demo` (MIT, Julius O. Smith III), `maths.lib` (LGPL with the Faust compiler exception, which permits distributing compiled output under any license). Full per-bundle metadata: `dsp-meta.json`.
- **Vendored JS runtimes** — `@webaudiomodules/sdk` + `sdk-parammgr` (MIT), `faustwasm` and `faust-ui` (MIT, GRAME).

The bundles are committed as example/test fixtures and are redistributable under this repository's MIT license with the attributions above.
