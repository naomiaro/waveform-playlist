# SoundFont API Follow-ups: `fromUrl` Factory + `isToneAdapter` Guard

**Date:** 2026-06-09
**Status:** Approved
**Packages:** `@waveform-playlist/playout`, `@waveform-playlist/browser`
**Origin:** Type-design review of PR #401 (soundfont late-load API)

## Goal

Two small, non-breaking additions to `@waveform-playlist/playout` that make the
soundfont API harder to misuse:

1. `SoundFontCache.fromUrl()` — a static async factory that resolves only after
   the SF2 is fetched and parsed, so an unloaded cache never reaches consumer
   hands on the common path.
2. `isToneAdapter()` — an exported type guard replacing the `Partial<ToneAdapter>`
   duck-typing cast in the browser package, and usable by dawcore/web-component
   consumers holding a generic `PlayoutAdapter`.

## Background

`SoundFontCache` is two-phase (construct → `await load(url)`), and both phases
are valid-looking objects. Passing an unloaded cache to
`createToneAdapter({ soundFontCache })` or `setSoundFontCache()` silently routes
MIDI to PolySynth (with a console warning since PR #401). The factory collapses
the phases for the common URL case; the two-phase API remains for
`loadFromBuffer` and advanced uses.

`packages/browser/src/soundFontSync.ts` currently capability-checks the adapter
via a cast: `(adapter as Partial<ToneAdapter>)?.setSoundFontCache`. The check is
correct but unexported — non-React consumers must reinvent it.

## Design

### 1. `SoundFontCache.fromUrl()` — `packages/playout/src/SoundFontCache.ts`

```typescript
static async fromUrl(
  url: string,
  options?: { context?: BaseAudioContext; signal?: AbortSignal }
): Promise<SoundFontCache> {
  const cache = new SoundFontCache(options?.context);
  await cache.load(url, options?.signal);
  return cache;
}
```

- Pure composition of the existing constructor + `load()` — no new failure
  modes. Rejection passes through `load()`'s errors (fetch failure, parse
  failure, AbortError).
- `signal` included for symmetry with `load(url, signal?)`.
- Options object (not positional args) so a future option doesn't force a
  signature break.

### 2. `isToneAdapter()` — `packages/playout/src/TonePlayoutAdapter.ts`

```typescript
export function isToneAdapter(
  adapter: PlayoutAdapter | null | undefined
): adapter is ToneAdapter {
  return typeof (adapter as Partial<ToneAdapter>)?.setSoundFontCache === 'function';
}
```

- Structural (capability) check, same runtime behavior as the current
  browser-side duck-typing — deliberately NOT an `instanceof`/brand check, so
  any adapter implementing the capability passes.
- Exported from `packages/playout/src/index.ts`.

### 3. Browser adoption — `packages/browser/src/soundFontSync.ts`

`syncSoundFontCacheToAdapter` uses `isToneAdapter(adapter)` instead of the
local cast. Public behavior unchanged; existing 4 tests must still pass
unmodified.

### 4. Documentation

- `website/docs/react/guides/midi.md`: switch both SoundFont snippets (initial
  load + "Loading the SoundFont late") to `SoundFontCache.fromUrl(...)`; keep
  the same-reference caveat.
- `examples/dawcore-tone/soundfont.html`: use `fromUrl` in the example.
- `packages/playout/CLAUDE.md`: one sentence each — `fromUrl` as the blessed
  path (note it defaults to OfflineAudioContext like the constructor), and
  `isToneAdapter` for capability checks.
- `website/static/llms.txt`: mention `SoundFontCache.fromUrl()` where SoundFont
  is described.
- Other surfaces: only if they already document `SoundFontCache` construction
  (grep before editing; don't add new sections).

### 5. Testing

- `SoundFontCache.test.ts`: `fromUrl` resolves to a loaded cache (mock fetch,
  reuse the file's existing fixture approach); rejects on fetch failure;
  forwards the abort signal; passes `context` through to the constructor.
- `TonePlayoutAdapter.test.ts`: `isToneAdapter` true for `createToneAdapter()`
  output; false for null/undefined/plain `PlayoutAdapter`-shaped object.
- Browser: existing `soundFontSync.test.ts` passes unchanged (behavioral
  equivalence of the refactor).

## Out of Scope

- Deprecating the two-phase `new SoundFontCache()` + `load()` API.
- Branded types for the `:midi` id convention or `_midiTrackBuild` records.
- Any engine-package changes.
