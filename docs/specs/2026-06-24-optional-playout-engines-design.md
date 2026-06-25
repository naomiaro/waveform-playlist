# Optional playout engines + injectable `PlayoutAdapter` (issue #510)

**Status:** Design approved (2026-06-24)
**Package:** `@waveform-playlist/browser` (13.1.3 → **14.0.0**, breaking)
**Issue:** [#510](https://github.com/naomiaro/waveform-playlist/issues/510)

## Problem

`@waveform-playlist/browser` declares **both** playout engines as hard `dependencies`:

- `@waveform-playlist/playout` — WebAudio / Tone.js engine (peer-requires `tone ^15`)
- `@waveform-playlist/media-element-playout` — HTML MediaElement engine (deps: `core` only)

This forces every consumer to install both engines, and — via `playout`'s peer — `tone`,
even when they (1) use only one rendering path, or (2) want to supply their own
`PlayoutAdapter` implementation and use neither bundled engine.

The `PlayoutAdapter` abstraction already exists in `@waveform-playlist/engine`
(`packages/engine/src/types.ts`), but the providers hardcode the concrete engines via
**static imports + direct instantiation**, so there is no injection point and both
packages are non-negotiable.

## Goals (acceptance criteria)

1. **WebAudio-only consumer:** installs `browser` + `playout` + `tone`, **not** `media-element-playout`.
2. **MediaElement-only consumer:** installs `browser` + `media-element-playout`, **not** `playout` or `tone`.
3. **Custom-playout consumer:** installs neither bundled engine; supplies a `PlayoutAdapter` and no `tone`.
4. Guard tests assert each path can mount with only its own engine present.

## Key insight: install graph ≠ bundle graph

Two independent mechanisms, two independent fixes:

- **Install graph** (what `npm install @waveform-playlist/browser` *forces*): controlled
  purely by `package.json`. Moving the engines to optional `peerDependencies` stops the
  package manager from auto-installing them and from warning when absent.
- **Bundle graph** (what a consumer's bundler must *resolve*): controlled by the shipped
  `dist`. A top-level `import 'tone'` in the published entry forces every consumer's
  bundler to resolve `tone` regardless of `peerDependenciesMeta`. Optional peers alone do
  **not** make the import optional.

Tree-shaking of unused re-exports (with `sideEffects: false`) already drops an unused
*provider subtree* — so the two single-path criteria (1 and 2) are mostly satisfiable once
the entry's eager `import * as Tone` is removed. The **custom-adapter** criterion (3) is
different: the bundler cannot prove `createAdapter` is always supplied, so a static
`import { createToneAdapter } from '@waveform-playlist/playout'` in the provider would
force `playout` to resolve even when it is never used at runtime. **That is what requires
the default engines to be loaded via dynamic `import()`** rather than static imports.

## Precedent reused

- **Dynamic-import an optional peer with an install-hint rethrow:** `@dawcore/midi`'s
  `loadMidiImpl` (`packages/dawcore/src/interactions/midi-loader.ts`) — `await import(pkg)`
  in a `try/catch` that `console.warn`s the original error and rethrows a friendly
  "install with…" message.
- **Optional peer deps via `peerDependenciesMeta`:** `annotations` / `recording` in
  `packages/browser/package.json`.
- **Guard test for the missing-peer path:** `daw-editor-load-midi-no-peer.test.ts` uses
  `vi.doMock(pkg, () => { throw … })` to simulate the package being absent.

## Scope tiers

The provider's **static import graph** must be `tone`/`playout`-free; exported **opt-in
hooks** may stay coupled because they are tree-shaken when unused.

### Tier 1 — core decoupling (required)

`package.json`, `index.tsx`, both providers' adapter/engine creation, sample-rate and
audio-clock sourcing. Makes the `WaveformPlaylistProvider` + `MediaElementPlaylistProvider`
mount/playback paths injectable and engine-optional.

### Tier 2 — render path (required for criterion 3)

`PlaylistVisualization` is rendered by essentially all WebAudio consumers and its only
`playout` import is `getGlobalAudioContext().currentTime`. Reroute that clock read through
context so the rendered waveform path is `playout`-free on a custom adapter.

### Tier 3 — out of scope (documented boundary)

`useDynamicEffects`, `useTrackDynamicEffects`, `useAudioEffects`, `effectFactory`,
`useExportWav`, `useOutputMeter`, `useAudioTracks`, `useAnnotationDragHandlers`,
`useDynamicTracks` stay `tone`/`playout`-coupled. They are opt-in hooks **not in the
provider's static graph**, so `sideEffects: false` tree-shakes them for consumers who do
not call them. A custom-adapter consumer who needs audio decoding brings their own (or a
follow-up revisits `useAudioTracks`). This boundary is documented, not silently left
half-required. Tracked as a follow-up issue.

**Implemented in Task 14 (issue #510):** All Tier-3 symbols — `useAudioTracks`,
`useDynamicTracks`, `useDynamicEffects`, `useTrackDynamicEffects`, `useExportWav`,
`useMasterAnalyser`, `useOutputMeter`, `ExportWavButton`, and the effects
factory/definitions (`effectDefinitions`, `effectCategories`, `getEffectDefinition`,
`getEffectsByCategory`, `createEffectInstance`, `createEffectChain`) — are re-exported
exclusively from `@waveform-playlist/browser/tone`. The core
`@waveform-playlist/browser` entry is structurally free of `tone`/`playout` (verified by
`coreBarrelEngineFree.test.ts`). Full bundle-level decoupling is achieved via the `/tone`
split: a MediaElement-only or custom-adapter consumer resolves zero `tone`/`playout` bytes.

## Changes

### 1. `packages/browser/package.json` — install graph

- `@waveform-playlist/playout`: `dependencies` → `peerDependencies` (`workspace:^`) +
  `peerDependenciesMeta.optional = true`.
- `@waveform-playlist/media-element-playout`: same move.
- `tone`: stays in `peerDependencies`, add `peerDependenciesMeta.optional = true`.
- `version`: `13.1.3` → `14.0.0`.

`@waveform-playlist/engine` stays a `dependency` (it carries the `PlayoutAdapter` type and
`PlaylistEngine`, used unconditionally). `core`, `loaders`, `ui-components`, `worklets`
unchanged.

### 2. `WaveformPlaylistContext.tsx` — `createAdapter` factory + dynamic default

New prop on `WaveformPlaylistProvider`:

```ts
/** Factory for a custom PlayoutAdapter. When omitted, the Tone.js engine
 *  (@waveform-playlist/playout) is dynamically imported. Called once per
 *  engine rebuild — the provider owns and disposes the returned instance. */
createAdapter?: () => PlayoutAdapter;
```

`loadAudio` (already `async`) resolves the adapter early, guarded by a per-run `cancelled`
flag to handle the dispose-before-resolve race introduced by `await import`:

```ts
let cancelled = false; // set true in the effect cleanup
// …inside loadAudio, before buffer/peak extraction so sampleRate is correct:
let adapter: PlayoutAdapter;
if (createAdapter) {
  adapter = createAdapter();
} else {
  let mod: typeof import('@waveform-playlist/playout');
  try {
    mod = await import('@waveform-playlist/playout');
  } catch (e) {
    console.warn('[waveform-playlist] @waveform-playlist/playout import failed: ' + String(e));
    throw new Error(INSTALL_HINT_PLAYOUT);
  }
  if (cancelled) return;
  if (sampleRateProp !== undefined) mod.configureGlobalContext({ sampleRate: sampleRateProp });
  adapter = mod.createToneAdapter({ effects, soundFontCache: soundFontCacheRef.current });
}
if (cancelled) { adapter.dispose(); return; }
adapterRef.current = adapter;
sampleRateRef.current = adapter.audioContext.sampleRate; // reconcile from the owning context
```

`effects` / `soundFontCache` are Tone-adapter-specific; a custom `createAdapter()` takes no
args and manages its own effects.

**Eliminate static `playout`/`tone` imports from this file:**

- `createToneAdapter`, `configureGlobalContext`, `getGlobalAudioContext` — removed from the
  top-level import. `createToneAdapter` + `configureGlobalContext` move into the dynamic
  default branch above; sample-rate now reads `adapter.audioContext.sampleRate`.
- `import { getContext } from 'tone'` — removed. The 4 `getContext().currentTime` sites
  (≈ lines 1055, 1236, 1266, 1312) become `adapterRef.current?.audioContext.currentTime`
  (null-guarded). For the Tone adapter, `adapter.audioContext` is the same
  `rawContext` as `getContext()`, so behavior is preserved; for a custom adapter it is the
  adapter's own clock.
- Type-only imports (`EffectsFunction`, `TrackEffectsFunction`, `SoundFontCache`) stay —
  erased at compile time, no runtime edge.

**Sample-rate-at-mount behavior change:** the `useState` lazy initializer stops calling
`playout`. It seeds `sampleRateProp ?? 48000` provisionally and reconciles from
`adapter.audioContext.sampleRate` once the adapter is created. A Tone consumer running at
44100 *and* passing no `sampleRate` prop sees 48000 for the brief pre-first-load window
(no tracks/peaks exist yet at mount, so impact is layout-only and self-corrects when the
first `loadAudio` creates the adapter). Documented as a 14.0.0 behavior note.

### 3. `MediaElementPlaylistContext.tsx` — `createPlayout` factory + dynamic default

New prop on `MediaElementPlaylistProvider`:

```ts
/** Factory for a custom MediaElement playout. When omitted, the bundled engine
 *  (@waveform-playlist/media-element-playout) is dynamically imported. */
createPlayout?: () => MediaElementPlayoutLike;
```

`MediaElementPlayoutLike` is a structural interface over `MediaElementPlayout`'s public
surface used by the provider (`addTrack`, `getTrack`, `setOnPlaybackComplete`, `dispose`,
playback controls). The init `useEffect` becomes async with the same `cancelled`-guard +
install-hint rethrow; the default branch does
`await import('@waveform-playlist/media-element-playout')`. The existing `duration`-dep
retrigger (which covers `playoutRef` child-effect timing) still applies, now with an
additional async hop before `playoutRef.current` is set.

### 4. `index.tsx` — remove the Tone re-export

Delete:

```ts
import * as Tone from 'tone';
export { Tone };
```

**Breaking** (public API). Migration: consumers `import * as Tone from 'tone'` directly
(they already depend on `tone` on the WebAudio path). The type-only
`export type { EffectsFunction, TrackEffectsFunction } from '@waveform-playlist/playout'`
stays (erased).

### 5. `PlaylistVisualization.tsx` (Tier 2)

The provider exposes an audio-clock getter via one of its context values:

```ts
getAudioContextTime: () => adapterRef.current?.audioContext.currentTime ?? 0
```

`PlaylistVisualization` consumes it instead of importing `getGlobalAudioContext`, removing
its last `playout` static import. (Memoize the getter so the context value identity is
stable.)

## Data flow (custom-adapter path)

```
consumer renders <WaveformPlaylistProvider createAdapter={() => myAdapter}>
  → loadAudio(): createAdapter() → myAdapter (owns its AudioContext)
  → adapterRef = myAdapter; sampleRateRef = myAdapter.audioContext.sampleRate
  → new PlaylistEngine({ adapter: myAdapter, … })
  → playback clock reads adapterRef.current.audioContext.currentTime
  → PlaylistVisualization reads getAudioContextTime() from context
  ⇒ @waveform-playlist/playout and tone are NEVER imported
```

## Testing (TDD)

New files under `packages/browser/src/__tests__/` (vitest + jsdom). Mirror the dawcore midi
precedent. RTL teardown runs inside `act()` (React-19 concurrent-commit cleanup rule).

**WaveformPlaylistProvider**

1. `custom-adapter-no-peer` (separate file): `vi.doMock('@waveform-playlist/playout', () => { throw … })`
   and `vi.doMock('tone', …)`; mount with `createAdapter` returning a mock `PlayoutAdapter`;
   assert it mounts and the rejecting import is never reached. *(criterion 3)*
2. `default-adapter`: mock `createToneAdapter` to return a mock adapter; mount without
   `createAdapter`; assert the dynamic import is invoked and the engine is built.
3. `no-peer-install-hint` (separate file): default path, `import('@waveform-playlist/playout')`
   rejects; assert the friendly install-hint surfaces and the original error is
   `console.warn`ed.

**MediaElementPlaylistProvider**

4. `custom-playout-no-peer`: `vi.doMock('@waveform-playlist/media-element-playout', () => { throw … })`;
   mount with `createPlayout` returning a mock; assert it mounts. *(criteria 1 & 2 isolation)*
5. `default-playout`: mock the module; assert dynamic import + `addTrack` wiring.
6. `no-peer-install-hint`: rejecting import → friendly hint + warn.

The mock `PlayoutAdapter` shape follows
`packages/dawcore/src/__tests__/daw-editor-load-midi-no-peer.test.ts:makeMockAdapter`
(includes `audioContext`, `ppqn`, `setTracks`, `init`, `isPlaying`, `dispose`, …).

## Docs

- `packages/browser/CLAUDE.md` — new props, the Tier-3 boundary, the sample-rate-at-mount
  behavior change, and the "provider static graph stays tone/playout-free" contract.
- Root `README.md`, `website/static/llms.txt`, `website/docs/api/llm-reference.md`,
  `website/docs/api/hooks.md` — new provider props; removed `Tone` re-export; 14.0.0
  migration note.
- A follow-up GitHub issue for the Tier-3 `useAudioTracks` decoupling.

## Out of scope

- Publishing: peer-range audit on packages that depend on `browser`, and the actual
  `npm publish`. This PR is code + version bump only.
- Decoupling Tier-3 hooks (effects/export/meter/`useAudioTracks`/dynamic-tracks).

## Risks

- **Async dispose race:** mitigated by the per-run `cancelled` flag that disposes a
  just-created adapter/playout if the effect was torn down during `await import`.
- **Sample-rate provisional window:** documented; layout-only, self-correcting.
- **Bundler variance:** dynamic `import()` of an absent optional peer is the robust path
  (separate async chunk), but consumers with unusual bundler configs may need their
  documented optional-peer setup — same caveat the existing `@dawcore/midi` pattern carries.
