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

## Dependencies

- `@waveform-playlist/core` — for `MidiNoteData` type.
- `@tonejs/midi` — the underlying parser.

No peer dependencies — this package is truly framework-agnostic.
