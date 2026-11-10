---
'@dawcore/faust': patch
---

A minified production build that mangles the Faust compiler's identifiers made `addFaustEffect` fail with an opaque `InvalidStateError: … is not defined in AudioWorkletGlobalScope`. `compileFaustToWam` now rethrows that error with the cause and the bundler setting that fixes it (Vite 8: `build.rolldownOptions.output.minify = { mangle: false }`; Vite 7 and earlier: `esbuild: { minifyIdentifiers: false }`), and the README documents it under "Production builds".
