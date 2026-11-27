# @dawcore/midi Package

## Purpose

Framework-agnostic MIDI: the pure `parseMidiFile`/`parseMidiUrl` functions, `loadMidiTracks` (a `.mid` file as `kind: 'midi'` `ClipTrack[]` for an arrangement), and the `MidiLoadOptions`/`MidiLoadResult` types used by `editor.loadMidi()` on `@dawcore/components`. No React, no DOM, no Lit.

**Consumers:**

- `@dawcore/components` — optional peer dep; `editor.loadMidi()` dynamic-imports this package and builds its tracks from `parseMidiFile`/`parseMidiUrl` itself (descriptors through `host.addTrack`), not through `loadMidiTracks`.
- React apps — `loadMidiTracks`, then `arrangement.addTrack(track)` for each track (the website's MIDI example, `debug/standalone-midi`).

**Until #807 there was a second package, `@waveform-playlist/midi`:** it re-exported this package's parser and defined `loadMidiTracks`. After its React hook `useMidiTracks` was removed (#812) it had no React code left, so `loadMidiTracks` and its test moved here and the package was removed from the workspace. Its last versions stay on npm (`13.0.4` on `latest`, `14.0.0-next.8` on `next`); marking it deprecated is a release step.

This package does the data pipeline only: `.mid` file → parser → `ClipTrack[]` with `midiNotes`. Synthesis (PolySynth, SoundFont, Transport scheduling) lives in `@waveform-playlist/playout` (`MidiToneTrack`, `SoundFontToneTrack`).

## Architecture

```
.mid file (URL, File or Blob)
       │
       ├── parseMidiUrl(url, opts, signal) ──┐
       └── parseMidiFile(buffer, opts) ──────┴── ParsedMidi { tracks, bpm, timeSignature, duration, name }
                                                       │
                                     loadMidiTracks    │  buildMidiTracks → createMidiTrack (not exported)
                                                       ▼
                                          ClipTrack[] (kind: 'midi', clip.midiNotes)
                                                       │
                                                       ▼
                                          arrangement.addTrack(track)
```

The parser was moved here from `@waveform-playlist/midi` so it can be reused by the web-components layer without pulling React into dawcore's transitive deps. See `docs/specs/2026-05-23-dawcore-load-midi-design.md`.

### `loadMidiTracks`

- **Tracks are MIDI tracks:** every track is built with `createTrack({ kind: 'midi', … })` (#756). A track without it is read as an audio track and the engine rejects its MIDI clip.
- **Multi-track expansion:** a `.mid` file with N MIDI tracks gives N `ClipTrack`s; `flatten: true` merges them into one.
- **`name`** renames the track and its clip only when the file yields exactly one track; several tracks keep their own MIDI names (e.g. "Piano", "Drums"), not prefixed, which keeps clip headers short in narrow controls.
- **MIDI has no native sample rate:** `sampleRate` is required on `LoadMidiTracksOptions` — pass the rate of the playlist's `AudioContext` (`getGlobalAudioContext().sampleRate` from playout with the default adapter). It positions clips in samples (`createClipFromSeconds`). Never hardcode a default: the real rate varies by hardware.
- **Abort:** `signal` is checked before the fetch, passed to `parseMidiUrl`, and checked after the parse; an abort rejects with the signal's reason and returns no tracks.

### Per-note channel

`MidiNoteData.channel` (optional, 0-indexed) is set from `track.channel`. This keeps channel identity when `flatten: true` merges all tracks — percussion notes (channel 9) remain routable to percussion synths in `MidiToneTrack` even in a mixed-channel clip.

### Program number (GM instrument)

`ParsedMidiTrack.programNumber` is set from `track.instrument.number`. Passed through `buildMidiTracks` → `clip.midiProgram` → `SoundFontToneTrack` for the instrument sample lookup. Defaults to 0 (Acoustic Grand Piano). Preserved in flatten mode.

### Track naming

`@tonejs/midi` defaults `track.instrument.name` to `"acoustic grand piano"` (program 0) even when no program change event exists. Use `track.instrument.number > 0` to detect explicitly-set instruments. Naming priority:

- Channel 9 → "Drums"
- Program > 0 → title-cased GM name (e.g., "Electric Bass (Finger)")
- Program 0 → track name from MIDI file → "Acoustic Grand Piano" → "Channel N"

### Flatten Is Visual-Only (Planned)

Flatten would merge `midiNotes` into one visual track but keep separate `ClipTrack` objects per channel for audio playback, the others with `hidden: true` so they produce audio without rendering.

**Why not single-track flatten:** Separate `PolySynth` instances per channel create natural chorus/phase thickening. A single synth playing all notes sounds perceptibly thinner, even though all notes are present and polyphony (peak: 19 concurrent) is well within limits (default: 32).

## Testing

`cd packages/dawcore-midi && npx vitest run` (Node environment; tests in `__tests__/` at the package root, not under `src/`).

Test data is synthesized via `@tonejs/midi`'s `Midi` constructor — no binary fixture files. `loadMidiTracks.test.ts` uses Node's own `Blob` (it has `arrayBuffer()`, which jsdom's did not, the reason for a workaround while the test lived in `@waveform-playlist/midi`) and `createArrangement` from `@waveform-playlist/engine`, a devDependency for that test only.

### @tonejs/midi gotchas

**Tempo — use `setTempo()` only:**

```typescript
// ✅ CORRECT — uses internal serialization
midi.header.setTempo(140);

// ❌ BROKEN — creates invalid binary data, causes infinite loop on re-parse
midi.header.tempos = [{ bpm: 140, ticks: 0 }];
```

Directly assigning `header.tempos` bypasses internal MIDI header serialization and produces binary data that causes `new Midi(data)` to infinite loop.

**Time signature — push to the array** (there is no `setTimeSignature()`):

```typescript
midi.header.timeSignatures.push({ ticks: 0, timeSignature: [3, 4], measures: 0 });
```

**Precision loss on round-trips:** MIDI stores tempo as integer microseconds-per-beat (`140` → `140.00014000014`) and velocity as a 0–127 integer (`0.9` → `114/127` ≈ `0.8976`). Use `toBeCloseTo()` in tests, not exact equality.

## Parser Facts (verified against @tonejs/midi 2.0.28 source, 2026-07-09)

- `header.tempos[0]` / `timeSignatures[0]` ARE the earliest events — upstream sorts both by tick during parse (`Header.update()`).
- The `channel === 9` → "Drums" heuristic is sound: upstream `splitTracks()` guarantees ≤1 [program, channel] pair per parsed track, even for multi-channel format-0 files.
- **Dense-file paths can't be tested through `parseMidiFile`** — `new Midi()` reparse of a 150k-note file takes ~10s. `getTrackDuration` is exported from `parseMidiFile.ts` (NOT from index.ts) for direct large-array tests; never spread unbounded arrays into `Math.max` (RangeError at ~130k args).

## Dependencies

- `@waveform-playlist/core` — `MidiNoteData`, `ClipTrack`, `createClipFromSeconds`, `createTrack`.
- `@tonejs/midi` — the underlying parser.
- `@waveform-playlist/engine` — devDependency, for `loadMidiTracks.test.ts`.

No peer dependencies and no `tone` dependency — this package parses and builds tracks; it does not play.
