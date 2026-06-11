# @dawcore/faust Package

**Purpose:** In-browser Faust DSP → WAM 2.0 compilation (`compileFaustToWam`). Consumed by `@dawcore/components` as an optional peer dep via dynamic import (the `@dawcore/midi` pattern) — non-Faust users pay zero bundle cost. Instantiation of the compiled class goes through `@dawcore/wam`'s `createWamInstanceFromFactory` — this package never duplicates the validate/wrap logic.

**Epic:** #414 (Faust DSP integration). Static mode (pre-compiled bundles via `addWamPlugin(url)`) was #429; this package is dynamic mode (#430).

**Build/test:** tsup (CJS+ESM+DTS). Tests: `cd packages/dawcore-faust && npx vitest run`. Scaffold mirrors `packages/dawcore-wam`.

## Conventions

- **`@shren/faust2wam` is exact-pinned** (zerover). Its published `dist/index.js` is a single ~8 MB self-contained ESM bundle — the libfaust compiler WASM **and** the Faust standard libraries are inlined as base64 data URIs, so no CDN fetch happens at runtime and no asset hosting is needed. A version bump must touch only this package.
- **Dynamic import of the compiler** — `compileFaustToWam` lazy-loads `@shren/faust2wam` on first call with a cached in-flight promise (failure-evicting; keyed by importFn so test injections don't touch the production cache). Mirrors `ensureWamHost`'s idempotency pattern.
- **`importFn` is injectable for tests** — never `vi.mock` the dynamic import (the loader.ts pattern from `@dawcore/wam`).
- **Faust compile errors propagate UNCHANGED** — the messages carry line/column diagnostics the user needs (`My Lowpass:2 : ERROR : undefined symbol : lowpasss`). Never wrap, prefix, or truncate them. A compile failure does NOT evict the loaded compiler module (only module-load failures evict).
- **Structural public types** — `FaustWamFactory`/`CompiledFaustWam` are structural so the alpha-versioned upstream typings (`@webaudiomodules/api` via faust2wam's d.ts) never leak into this package's surface. `@webaudiomodules/api` is a devDep for typecheck only.
- Test-only helpers (`_resetFaustCompilerCacheForTests`) are exported from their module but **not** from `src/index.ts` — tests deep-import from `../src/compiler`.

## faust2wam API facts

- `import generate from '@shren/faust2wam'` — default export: `generate(code, name?, argv?, polyOrFFT?) → Promise<typeof WebAudioModule>`. The returned class extends the SDK's `WebAudioModule`, so it has a static `createInstance(groupId, audioContext, initialState?)` — factory-shaped, exactly what `createWamInstanceFromFactory` consumes.
- The compile name becomes the descriptor name (and therefore dawcore's chain label) **unless the DSP has a `declare name`**, which wins.
- `generate` calls `instantiateFaustModule()` per invocation — each compile re-instantiates libfaust. Slow path, acceptable for v1 (no compile caching by design).
- Per-channel semantics: `process = filter, filter;` is stereo; a single `process = filter;` is mono and the generated node has 1 input channel — dawcore track chains are stereo, so demos/doc examples must use the stereo form.

## dawcore integration (lives in packages/dawcore, documented here for discoverability)

- `addFaustEffect(dspCode, { name? })` on `<daw-editor>`/`<daw-track>` → `EffectsManager._addFaustToChain`: validate → compile (BEFORE any chain work, so errors leave the chain untouched) → `ensureWamHost` → `createWamInstanceFromFactory` → shared `_insertWamPlugin` (same helper as `addWamPlugin`).
- Chain entries are `kind: 'wam'` with `source: { faust: dspCode }` and **no url**. Serialized form: `{ kind: 'wam', faustDsp, faustName?, bypassed, state? }` — restore and offline export **recompile** via this package. Failed recompiles become bypassed placeholders that round-trip the saved DSP + state.
