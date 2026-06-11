# @dawcore/wam Package

**Purpose:** Framework-agnostic WAM 2.0 (Web Audio Modules) plugin hosting. Consumed by `@dawcore/components` as an optional peer dep via dynamic import (the `@dawcore/midi` pattern) — non-WAM users pay zero bundle cost.

**Epic:** Sub-issues of #413 land here incrementally (host init → loader → chain integration → GUI → persistence → transport bridge → offline export → discovery).

**Build/test:** tsup (CJS+ESM+DTS), `pnpm typecheck && tsup`-style. Tests: `cd packages/dawcore-wam && npx vitest run`. Scaffold mirrors `packages/dawcore-midi`.

## Conventions

- **SDK deps are exact-pinned** (`@webaudiomodules/api`, `@webaudiomodules/sdk` — alpha/zerover). A breaking SDK bump must touch only this package.
- **No DOM/Lit/React** — anything UI-flavored ships as plain-DOM factories so the future React layer reuses it.
- Test-only helpers (e.g. `_resetWamHostCacheForTests`) are exported from their module but **not** from `src/index.ts` — tests deep-import from `../src/<module>`.
- Mock the SDK boundary in tests with `vi.hoisted` + `vi.mock('@webaudiomodules/sdk', ...)` — a plain `const fn = vi.fn()` referenced in a mock factory hits the TDZ because the factory executes during import resolution.
- **No package-level vitest config (node env).** DOM-needing test files opt in per-file with a `// @vitest-environment happy-dom` docblock (see `__tests__/gui.test.ts`); `happy-dom` is a devDep.
- **happy-dom strips `var()` from known color properties** (`color`, `background`) on inline styles but passes it through for `accent-color`. Don't assert panel color/background vars in tests — assert class hooks + slider `accentColor` instead; the var() fallbacks are browser-verified.

## Host Initialization (`src/host.ts`)

`ensureWamHost(audioContext)` — idempotent per context (WeakMap of in-flight promises; concurrent callers share one init), failure-evicting (retry re-inits). State guards: `closed` rejects; realtime contexts must be `running` (worklet load needs a post-gesture resume); **`OfflineAudioContext` is accepted while `'suspended'`** (detected via `'startRendering' in ctx`) — offline rendering inits the host *before* `startRendering()`, and a naive running-check would make offline WAM export (#426) impossible.

## Plugin Loader (`src/loader.ts`)

- `loadWamFactory(url, importFn?)` — dynamic `import(url)` → default export. Cached per URL (in-flight promise shared, failures evicted for retry). `importFn` is injectable for tests — never `vi.mock` dynamic URL imports.
- `createWamInstance(url, ctx, hostGroupId, { initialState?, importFn? })` — load → `factory.createInstance(hostGroupId, ctx)` → **validate descriptor AFTER instantiation** (many plugins only expose it on the instance) → optional `setState(initialState)`. Validation or state failure destroys the instance before throwing.
- **Effect-only validation**: `apiVersion` must be `2.x`; `hasAudioInput` AND `hasAudioOutput` required — instrument-only plugins are rejected with an explanatory error (MIDI/instrument hosting is out of epic scope).
- Wrapper `WamPluginInstance` has idempotent `destroy()` (audio only) plus **optional `createGui`/`destroyGui` passthroughs** — present only when the underlying WebAudioModule exposes them (GUI lifecycle lives on the module, NOT the audioNode; absence = headless plugin = consumer falls back to the generic panel). `destroy()` never touches GUIs — the GUI/audio lifecycles are deliberately split (wam-studio `Models/Plugin.ts` pattern). Types are structural (`WamFactory`, `WamPluginAudioNode`) rather than the SDK's alpha typings — keeps the public surface stable across SDK bumps.

## GUI Helpers (`src/gui.ts`)

- **Plain-DOM factories, no Lit/React** — so the future React layer can reuse them. `createParameterPanel(params, onChange)` is the sync generic builder (one labeled `<input type="range">` per `ParameterPanelParam`); `createWamParameterPanel(node, { onParamChange? })` awaits `node.getParameterInfo()`, maps `WamParameterInfoLike` ({id, label, minValue, maxValue, defaultValue, discreteStep, units}) onto panel params, and wires edits to `node.setParameterValues` unless `onParamChange` overrides the routing (dawcore overrides it to route through its setParams op so `daw-effect-change` fires).
- **Spec-aligned defaults**: absent `minValue`/`maxValue` → 0..1 (WAM spec default range); absent `discreteStep` → `step="any"`; initial value = `defaultValue` clamped, else `min`.
- **Boundary validation, never fail the panel**: malformed entries (no id, invalid range, non-object info) skip with `[waveform-playlist]` warnings; zero usable params renders a "No adjustable parameters." empty state; a non-object `getParameterInfo()` result throws.
- **Themable via `--daw-*` vars** with fallbacks (`--daw-controls-text`, `--daw-controls-background`, `--daw-wave-color` for slider accent) + stable class names (`daw-param-panel`, `daw-param-row`, `daw-param-name`, `daw-param-value`, `daw-param-slider`).

## Library Discovery (`src/library.ts`)

- `fetchWamLibrary(manifestUrl, { fetchFn?, baseUrl? })` → `{ entries, warnings }` — fetch + schema-validate `library.json` manifests at the boundary. `fetchFn` is injectable for tests (structural `WamManifestResponse`, no full `Response` needed); no caching by design.
- **Common-denominator schema** (surveyed from webaudiomodules.com community `plugins.json` and pedalboard2/wam-studio libraries): top-level array OR `{ plugins: [...] }`; entries are objects (`name` + `url`/`path` required; optional description/vendor/thumbnail/keywords passed through when well-formed) or bare URL strings (name derived from URL, skipping generic segments like `index.js`/`dist`/`src`).
- Relative plugin/thumbnail URLs resolve against the manifest URL; **`baseUrl` option exists because webaudiomodules.com keeps `path` relative to `community/plugins/`, not the manifest** — manifest-relative resolution alone 404s there.
- Invalid entries skip with `[waveform-playlist]`-prefixed messages collected into `warnings` (never fail the manifest); unreachable/invalid-JSON/unrecognized-shape/zero-valid-entries reject. Entry `url` feeds straight into `createWamInstance` — descriptor validation stays at load time.
- Real-world fixture manifests live as constants in `__tests__/library.test.ts` with source URLs in comments.

## Offline Cloning (`cloneInstanceInto`, #426)

`cloneInstanceInto(instance, targetContext, hostGroupId)` — WAM nodes are AudioWorklets bound to one context; offline rendering re-instantiates from the URL-cached factory on the OfflineAudioContext and transfers `getState()` (wam-studio `cloneInto` pattern). `ensureWamHost` already accepts suspended offline contexts.

## Transport Bridge (`src/transport-bridge.ts`, #425)

`createWamTransportBridge(transport, getPluginNodes)` — broadcasts `wam-transport` events ({playing, tempo, timeSig, currentBar, currentBarStarted}) to all live plugin nodes on play/pause/stop/seek/tempochange/meterchange. **Variable-tempo boundary crossings emit no transport event** — a rAF watcher (active only while playing) compares tempo/meter at the playhead each frame and rebroadcasts on change. `currentBarStarted` is AudioContext time: `ctx.currentTime - (transportSeconds - barStartSeconds)`. Structural `TransportQueryLike` keeps the transport package plugin-free; `WamTransportNode.scheduleEvents` is optional (the loader's structural node type can't require it) and guarded. dawcore's `EffectsManager` creates the bridge lazily on first `addWamPlugin`, feeds it the live-node Set (entries' dispose closures self-remove), and skips it silently when the adapter transport lacks the query surface.

## Reference Implementation

wam-studio (local checkout at `~/Code/wam-studio`) — `public/src/Models/Plugin.ts` shows the full plugin lifecycle: `createInstance(hostGroupId, ctx)`, GUI/audio lifecycle split (`createGui`/`destroyGui` independent of `audioNode.destroy()`), and `cloneInto(offlineCtx, groupId)` for offline rendering via getState/setState transfer.
