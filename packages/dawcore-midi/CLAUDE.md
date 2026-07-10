# @dawcore/midi Package

## Purpose

Framework-agnostic MIDI file loading and parsing. Houses the pure `parseMidiFile`/`parseMidiUrl` functions and the `MidiLoadOptions`/`MidiLoadResult` types used by `editor.loadMidi()` on `@dawcore/components`. No React, no DOM, no Lit.

**Consumers:**

- `@dawcore/components` — optional peer dep; `editor.loadMidi()` dynamic-imports this package.
- `@waveform-playlist/midi` — regular dep; re-exports the parser and provides `useMidiTracks` hook on top.

## Architecture

```
.mid file (URL or File)
       │
       ├── parseMidiUrl(url, opts, signal) ──┐
       └── parseMidiFile(buffer, opts) ──────┴── ParsedMidi { tracks, bpm, timeSignature, duration, name }
```

The parser was moved here from `@waveform-playlist/midi` so it can be reused by the web-components layer without pulling React into dawcore's transitive deps. See `docs/specs/2026-05-23-dawcore-load-midi-design.md`.

## Testing

`cd packages/dawcore-midi && npx vitest run`

Test data is synthesized via `@tonejs/midi`'s `Midi` constructor — no binary fixture files. See the `@tonejs/midi` gotchas in `packages/midi/CLAUDE.md` (tempo: use `setTempo()` not direct assignment; precision loss on velocity / BPM round-trips).

## Parser Facts (verified against @tonejs/midi 2.0.28 source, 2026-07-09)

- `header.tempos[0]` / `timeSignatures[0]` ARE the earliest events — upstream sorts both by tick during parse (`Header.update()`).
- The `channel === 9` → "Drums" heuristic is sound: upstream `splitTracks()` guarantees ≤1 [program, channel] pair per parsed track, even for multi-channel format-0 files.
- **Dense-file paths can't be tested through `parseMidiFile`** — `new Midi()` reparse of a 150k-note file takes ~10s. `getTrackDuration` is exported from `parseMidiFile.ts` (NOT from index.ts) for direct large-array tests; never spread unbounded arrays into `Math.max` (RangeError at ~130k args).

## Dependencies

- `@waveform-playlist/core` — for `MidiNoteData` type.
- `@tonejs/midi` — the underlying parser.

No peer dependencies — this package is truly framework-agnostic.
