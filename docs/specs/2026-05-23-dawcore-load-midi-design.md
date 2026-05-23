# dawcore `editor.loadMidi()` — Design

**Status:** Approved (brainstorming complete, pending implementation)
**Date:** 2026-05-23
**Author:** Naomi Aro (with Claude)
**Related spec:** [`web-components-migration.md`](./web-components-migration.md) (MIDI Loading section, lines 1120-1158)
**Precedent:** Spectrogram framework split — PR [#387](https://github.com/naomiaro/waveform-playlist/pull/387)

## Goal

Add `editor.loadMidi(source, options)` to `<daw-editor>` so consumers can imperatively load a `.mid` file from a URL or `File` and have N `<daw-track>` elements created automatically — one per note-bearing MIDI track. Required because a `.mid` file's track count is unknowable at HTML authoring time.

This builds on the programmatic MIDI surface added in PR [#385](https://github.com/naomiaro/waveform-playlist/pull/385) (`editor.addTrack({ midi: { notes } })`). The synth, piano-roll renderer, and clip plumbing already exist; this PR adds the file-loading entry point.

## Non-Goals (deferred)

- **`flatten: true` option.** Defers until dawcore grows a "hidden audio-only track" concept. The React `@waveform-playlist/midi` package's flatten behavior (visual-merge + per-channel synths under the hood for natural thickening) is not portable to dawcore without that primitive.
- **`name` override option.** Ambiguous semantics with multi-track files (5 tracks ≠ 5 copies of the same name). MIDI's own track names are used unconditionally. Can revisit if a concrete need surfaces.
- **Auto-apply of tempo / time signature.** `loadMidi` returns `bpm` and `timeSignature` from the MIDI header; the caller decides whether to apply them. Mirrors the spec example flow; predictable for multi-file loads; trivially upgradable via an opt-in flag later.

_Note: cleanup-on-failure was originally deferred to v2; promoted to v1 — see [Error Handling](#error-handling)._

## Architecture

### New package: `@dawcore/midi` (initial 0.0.1)

Mirrors the `@dawcore/spectrogram` split. Houses the pure framework-agnostic MIDI parser and types — no React, no DOM, no Lit.

```
packages/dawcore-midi/
├── package.json         deps: @waveform-playlist/core (workspace:*), @tonejs/midi
├── tsup.config.ts
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts                       re-exports parser + types
    ├── parseMidiFile.ts               MOVED from @waveform-playlist/midi
    ├── types.ts                       MidiLoadOptions, MidiLoadResult
    └── __tests__/
        └── parseMidiFile.test.ts      MOVED with file
```

**Exports:**
- `parseMidiFile(data: ArrayBuffer, options?: ParseMidiOptions): ParsedMidi`
- `parseMidiUrl(url: string, options?: ParseMidiOptions, signal?: AbortSignal): Promise<ParsedMidi>`
- Types: `ParsedMidi`, `ParsedMidiTrack`, `ParseMidiOptions`, `MidiLoadOptions`, `MidiLoadResult`

### Refactored package: `@waveform-playlist/midi` → 13.0.0

Becomes a thin React wrapper. Depends on `@dawcore/midi` (`workspace:*`). Keeps `useMidiTracks` hook unchanged. Re-exports parser + types so existing consumers see no API change.

```
packages/midi/
└── src/
    ├── index.ts                       re-exports from @dawcore/midi + own hook
    ├── useMidiTracks.ts               unchanged; imports from @dawcore/midi
    └── __tests__/
        └── useMidiTracks.test.ts      unchanged
```

### Updated package: `@dawcore/components`

- Optional peer dep on `@dawcore/midi` (`peerDependenciesMeta: { '@dawcore/midi': { optional: true } }`)
- New file: `packages/dawcore/src/interactions/midi-loader.ts` — mirrors the `file-loader.ts` extraction pattern; keeps `daw-editor.ts` under the 800-line CLAUDE.md budget
- New method on `<daw-editor>`: `loadMidi(source, options)` — one-liner that delegates to `loadMidiImpl(this, source, options)`

### Version bump propagation

Per the `workspace:*` + zerover pinning rules in MEMORY:
- `@dawcore/midi`: new at `0.0.1`
- `@waveform-playlist/midi`: `12.0.0` → `13.0.0` (breaking dep churn; parser now re-exported from `@dawcore/midi`)
- `@dawcore/components`: minor bump (additive API + new optional peer dep)
- `@waveform-playlist/*` packages that re-export or depend on `@waveform-playlist/midi` via `workspace:*`: patch republish so React users get the new dep tree (per the `workspace_star_zerover_pinning` MEMORY rule)

## API Surface

```typescript
// On <daw-editor>
loadMidi(source: string | File, options?: MidiLoadOptions): Promise<MidiLoadResult>

// In @dawcore/midi
interface MidiLoadOptions {
  /** Timeline position in seconds applied to every created clip (default: 0) */
  startTime?: number;
  /** AbortSignal forwarded to fetch() when source is a URL */
  signal?: AbortSignal;
}

interface MidiLoadResult {
  /** IDs of the <daw-track> elements created, in MIDI track order */
  trackIds: string[];
  /** Tempo from MIDI header (defaults to 120 if absent) */
  bpm: number;
  /** Time signature [numerator, denominator] (defaults to [4, 4] if absent) */
  timeSignature: [number, number];
  /** Total duration of the loaded MIDI in seconds (max across tracks) */
  duration: number;
  /** Song name from MIDI header — empty string when not set */
  name: string;
}
```

### Source types

- `string` → forwarded to `parseMidiUrl(source, undefined, options.signal)` (fetch + parse)
- `File` → `await source.arrayBuffer()` then `parseMidiFile(buffer)`
- `Blob` / `ArrayBuffer` deliberately excluded in v1 (`File extends Blob`, so File covers drop and `<input type="file">` cases; bare `ArrayBuffer` has no concrete consumer yet)

### Empty-file behavior

A `.mid` file with no note-bearing tracks resolves to `{ trackIds: [], bpm, timeSignature, duration: 0, name }`. No `<daw-track>` elements are created. The bpm/timeSignature from the header are still returned so the caller can sync the grid.

### Usage

```javascript
// Multi-track file → N <daw-track> elements
const result = await editor.loadMidi('/midi/RedHotChiliPeppers-Otherside.mid');

// Apply tempo / time signature from the file (caller decides)
editor.bpm = result.bpm;
editor.timeSignature = result.timeSignature;

// Offset on the timeline
await editor.loadMidi('/midi/bridge.mid', { startTime: 30 });

// File from <input type="file">
const file = inputEl.files[0];
const { trackIds } = await editor.loadMidi(file);

// Cancelation
const ctrl = new AbortController();
const p = editor.loadMidi('/midi/long.mid', { signal: ctrl.signal });
ctrl.abort();
// p rejects with AbortError
```

## Data Flow

```
editor.loadMidi(source, options)
       │
       ├── (1) dynamic-import('@dawcore/midi')        ── reject with install hint if missing
       │
       ├── (2a) string source  → parseMidiUrl(source, undefined, options.signal)
       └── (2b) File   source  → source.arrayBuffer() → parseMidiFile(buf)
                                            │
                                            ▼ ParsedMidi { tracks, bpm, timeSignature, duration, name }
       │
       ├── (3) Promise.allSettled(parsed.tracks.map(t => this.addTrack({
       │           name: t.name,
       │           renderMode: 'piano-roll',
       │           clips: [{
       │               midiNotes: t.notes,
       │               midiChannel: t.channel,
       │               midiProgram: t.programNumber,
       │               start: options.startTime ?? 0,
       │           }],
       │       })))
       │       → settles either to DawTrackElement (fulfilled) or Error (rejected)
       │
       ├── (4) Partition: succeeded[] = fulfilled values, firstError = first rejection (if any)
       │
       ├── (5) if firstError exists:
       │         for (const el of succeeded) el.remove();    // cleanup-on-failure
       │         throw firstError;
       │
       └── (6) return { trackIds: succeeded.map(e => e.trackId), bpm, timeSignature, duration, name }
```

Implementation lives in `packages/dawcore/src/interactions/midi-loader.ts` exposing `loadMidiImpl(host, source, options)`. `<daw-editor>` keeps the public method one-liner that delegates — matches `loadFiles` → `loadFilesImpl` extraction pattern.

`addTrack` is called explicitly (not the `midi: { notes }` shorthand) because we need to set the clip's `start` to `options.startTime`. The shorthand always sets `start: 0`.

`Promise.allSettled` (not `Promise.all`) runs the N track loads concurrently — matches how N declarative `<daw-track>` children load today — and waits for all to resolve or reject before we decide whether to commit or roll back. Without `allSettled`, a `Promise.all` rejection would abort early but leave the still-in-flight `addTrack` calls to complete in the background and append more `<daw-track>` elements after we'd already "cleaned up" — a race. `allSettled` guarantees every track call has fully resolved (or rejected) before the cleanup loop runs.

`el.remove()` is sufficient for cleanup: `<daw-editor>`'s MutationObserver detects the detachment and calls `_onTrackRemoved`, which tears down engine state, peaks, and per-clip caches (per the dawcore CLAUDE.md "Track removal detected by editor's MutationObserver" pattern).

Each track goes through `_loadTrack`'s MIDI branch (the existing path that produces a 1-second placeholder span when notes are absent, ensuring late `daw-clip-update` events can find the clip — but in this case notes are present upfront).

## Error Handling

| Failure mode | Behavior |
|--------------|----------|
| `@dawcore/midi` not installed | dynamic import rejects → re-throw `Error('@dawcore/midi is required for loadMidi(). Install with: npm install @dawcore/midi')`. No tracks created, nothing to clean up. |
| Fetch failure / non-OK status | rethrow from `parseMidiUrl` (existing helper already does this). No tracks created. |
| Parse failure (corrupt file) | rethrow from `parseMidiFile` (existing `new Midi(buf)` throws). No tracks created. |
| Abort during fetch | `signal.abort()` → AbortError propagates from fetch. No tracks created. |
| One of N tracks fails during addTrack | `Promise.allSettled` waits for all settlements, then `loadMidi` calls `.remove()` on every successfully-created track and throws the first rejection. The editor returns to its pre-call state — no orphaned `<daw-track>` elements, no orphaned engine state (MutationObserver tears down engine state on detachment). |

**Abort during addTrack phase:** `signal.abort()` after `parseMidi*` has resolved does NOT cancel the in-flight track creation — `addTrack` does not currently accept an `AbortSignal`. The N track creations run to completion (success or failure) regardless of subsequent abort. Documented v1 limitation; future work could thread `signal` into `addTrack`.

`loadMidi` itself does NOT dispatch `daw-error`. Consumers may wrap in try/catch and dispatch one themselves — matches the `loadFiles` pattern (the drop handler dispatches `daw-error` on `loadFiles` failure, but `loadFiles` is a clean throw).

## Outdated Spec Updates (web-components-migration.md)

Scope-bounded to what was found stale during this design work.

| Spec lines | Change |
|------------|--------|
| 148-149 | `<daw-tempo>` wraps `editor.bpm` property assignment (not `setBpm()` method); same for `<daw-time-signature>` → `editor.timeSignature` |
| 409-414 | Replace `editor.setBpm()` / `setTimeSignature()` / `setSnapTo()` / `setScaleMode()` / `setLoopEnabled()` with property-assignment shape (`editor.bpm = n`, `editor.timeSignature = [n, d]`, etc.). Verify `setLoopRegion()` against current `daw-editor.ts` — keep as method if still implemented as one. |
| 1120-1158 | Rewrite MIDI section per this design: drop `flatten` and `name` from `MidiLoadOptions`; add `signal`; add `name` to `MidiLoadResult`; replace `setBpm` / `setTimeSignature` examples with property assignment; remove `flatten: true` example; add a note that flatten is deferred to a future PR |
| 1516, 1521 | Update `loadFiles()` MIDI auto-routing text to match the new `MidiLoadOptions` / `MidiLoadResult` shapes |

Other `set*`-method references elsewhere in the spec are out of scope for this PR.

## Testing

### `packages/dawcore-midi/` (new)

All existing `parseMidiFile.test.ts` cases move here verbatim (8 tests). Test infrastructure copied from `@waveform-playlist/midi`: vitest, MIDI fixtures created programmatically via `@tonejs/midi`'s `Midi` constructor (no binary fixture files).

```
cd packages/dawcore-midi && npx vitest run
```

### `packages/midi/`

- `useMidiTracks.test.ts` (12 tests) stays in place — now exercises the parser via `@dawcore/midi` (re-exported).
- One new behavioral smoke test: import `parseMidiFile` from both `@waveform-playlist/midi` and `@dawcore/midi`, call each on the same synthesized MIDI buffer, assert the parsed outputs are structurally equal. (Identity equality is unreliable across bundle boundaries; behavioral parity is what we actually need to guarantee.)

### `packages/dawcore/src/__tests__/daw-editor-load-midi.test.ts` (new)

Mocks `@dawcore/midi` so no binary MIDI fixture is needed. Cases:

- URL source → `parseMidiUrl` called with `(source, undefined, signal)`
- File source → `arrayBuffer()` called, then `parseMidiFile(buf)`
- Multi-track file → creates N `<daw-track>` elements, `result.trackIds.length === N`, names match MIDI track names
- Single-track file → 1 track
- Empty file (no note-bearing tracks) → `trackIds: []`, `bpm` / `timeSignature` still returned from header
- `startTime: 30` → every created clip has `start === 30`
- Missing `@dawcore/midi` peer dep → rejects with the install-hint message
- `signal` forwarded to `parseMidiUrl`
- bpm / timeSignature / duration / name correctly propagated from parsed data to result
- **Cleanup-on-failure:** mock `addTrack` to fulfill for tracks 0 and 2, reject for track 1. Expect: `loadMidi` rejects with track 1's error, `editor.querySelectorAll('daw-track').length === 0`, engine state is empty (`<daw-editor>._engineTracks.size === 0`).
- **Cleanup waits for all settlements:** mock track 0 to reject immediately and track 1 to fulfill after a microtask. Expect: track 1's element gets removed (proving cleanup ran AFTER track 1 settled, not before).

### Manual / example

`examples/dawcore-tone/midi-load.html` (new) — loads the existing `RedHotChiliPeppers-Otherside.mid` from `website/static/media/midi/`. Linked from `examples/dawcore-tone/index.html`. Demonstrates:
- URL load
- Reading `result.bpm` and assigning `editor.bpm`
- A second `<input type="file">` for File-source loading

No new asset needed.

## Open Questions / Future Work

- **Cancellable addTrack.** `addTrack` does not currently accept an `AbortSignal`, so `signal.abort()` after parsing is a no-op. Threading the signal through `addTrack` (and the underlying `_loadTrack` audio fetch / decode pipeline) would let `loadMidi` cancel mid-creation and still leave a clean state via the existing cleanup loop.
- **`flatten: true` requires hidden tracks.** When dawcore grows a "hidden audio-only track" concept (likely driven by another use case), revisit and add `flatten` to match React parity.
- **`name` override.** If a use case appears (e.g., loading the same MIDI file twice with different prefixes), revisit with a name-template option like `{ namePattern: 'Section A: {name}' }` rather than a single `name`.
- **Auto-apply tempo / time signature.** A future `{ applyTempo: boolean, applyTimeSignature: boolean }` flag (default false to preserve current behavior) is a low-risk addition.
- **MIDI clip late-append.** Out of scope — already documented as unsupported in dawcore CLAUDE.md ("MIDI clip late-append is unsupported"). `loadMidi` only uses the supported `addTrack({ midi })` path.
