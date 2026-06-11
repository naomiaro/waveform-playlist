# @dawcore/wam Package

**Purpose:** Framework-agnostic WAM 2.0 (Web Audio Modules) plugin hosting. Consumed by `@dawcore/components` as an optional peer dep via dynamic import (the `@dawcore/midi` pattern) — non-WAM users pay zero bundle cost.

**Epic:** Sub-issues of #413 land here incrementally (host init → loader → chain integration → GUI → persistence → transport bridge → offline export → discovery).

**Build/test:** tsup (CJS+ESM+DTS), `pnpm typecheck && tsup`-style. Tests: `cd packages/dawcore-wam && npx vitest run`. Scaffold mirrors `packages/dawcore-midi`.

## Conventions

- **SDK deps are exact-pinned** (`@webaudiomodules/api`, `@webaudiomodules/sdk` — alpha/zerover). A breaking SDK bump must touch only this package.
- **No DOM/Lit/React** — anything UI-flavored ships as plain-DOM factories so the future React layer reuses it.
- Test-only helpers (e.g. `_resetWamHostCacheForTests`) are exported from their module but **not** from `src/index.ts` — tests deep-import from `../src/<module>`.
- Mock the SDK boundary in tests with `vi.hoisted` + `vi.mock('@webaudiomodules/sdk', ...)` — a plain `const fn = vi.fn()` referenced in a mock factory hits the TDZ because the factory executes during import resolution.

## Host Initialization (`src/host.ts`)

`ensureWamHost(audioContext)` — idempotent per context (WeakMap of in-flight promises; concurrent callers share one init), failure-evicting (retry re-inits). State guards: `closed` rejects; realtime contexts must be `running` (worklet load needs a post-gesture resume); **`OfflineAudioContext` is accepted while `'suspended'`** (detected via `'startRendering' in ctx`) — offline rendering inits the host *before* `startRendering()`, and a naive running-check would make offline WAM export (#426) impossible.

## Reference Implementation

wam-studio (local checkout at `~/Code/wam-studio`) — `public/src/Models/Plugin.ts` shows the full plugin lifecycle: `createInstance(hostGroupId, ctx)`, GUI/audio lifecycle split (`createGui`/`destroyGui` independent of `audioNode.destroy()`), and `cloneInto(offlineCtx, groupId)` for offline rendering via getState/setState transfer.
