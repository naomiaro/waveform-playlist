# MIDI Package (`@waveform-playlist/midi`)

## Parser Now Lives in `@dawcore/midi`

As of v13.0.0, `parseMidiFile` / `parseMidiUrl` and the `ParsedMidi*` types are re-exported from `@dawcore/midi`. The local copy was removed during the dawcore framework-split. React-side consumers see no API change. The `parser-parity.test.ts` smoke test guards against accidental re-divergence.

`loadMidiTracks` and its options type `LoadMidiTracksOptions` are what this package defines itself (`loadMidiTracks.ts` also holds the one place a MIDI track is built, `createMidiTrack`, which is not exported). The `useMidiTracks` hook, `midiConfigsEqual` and their tests were removed with the last part of #812: the provider takes an arrangement, not a `tracks` array, and the package has no React code and no `react` peer.

## Purpose

Provides MIDI file loading and parsing for waveform-playlist's React packages. Separates `@tonejs/midi` (~8-12 KB gzipped) into an opt-in package so users who only need audio don't pay the bundle cost.

**This package handles the data pipeline only:** `.mid` file → parser → `ClipTrack[]` with `midiNotes`. Actual MIDI synthesis (PolySynth, Transport scheduling) lives in `@waveform-playlist/playout` via `MidiToneTrack`.

## Architecture

### Data Flow

```
.mid file URL ──► fetch ──► ArrayBuffer ──► parseMidiFile() ──► ParsedMidi
                                                                    │
                                                            ┌───────┴───────┐
                                                            ▼               ▼
                                                    ParsedMidiTrack   ParsedMidiTrack
                                                            │               │
                                             loadMidiTracks │               │
                                                            ▼               ▼
                                                      ClipTrack        ClipTrack
                                                   (clip.midiNotes)  (clip.midiNotes)
                                                            │               │
                                                            └───────┬───────┘
                                                                    ▼
                                                    arrangement.addTrack(track)
```

### Two-Layer Design

1. **`parseMidiFile()`** — Pure function, no React. Converts `@tonejs/midi` output to `MidiNoteData[]` format. Can be used standalone (Node.js scripts, non-React apps).

2. **`loadMidiTracks()`** — An async function, no React. Takes a URL, a `File` or a `Blob`, parses it and builds one `kind: 'midi'` `ClipTrack` per parsed track (`buildMidiTracks` → `createMidiTrack`). The caller keeps its own loading and error state and adds the tracks to the arrangement.

### Tracks Are MIDI Tracks

`loadMidiTracks` builds every track with `createTrack({ kind: 'midi', … })` (#756). A track without it is read as an audio track and the engine rejects its MIDI clip.

### Multi-Track Expansion

One `loadMidiTracks` call can produce multiple `ClipTrack` objects. A `.mid` file with N MIDI tracks generates N `ClipTrack`s by default. The `flatten: true` option merges all tracks into one.

### Per-Note Channel Field

`MidiNoteData.channel` (optional, 0-indexed) is set by `mapNotes()` from `track.channel`. This preserves channel identity when `flatten: true` merges all tracks — percussion notes (channel 9) remain routable to percussion synths in `MidiToneTrack` even in a mixed-channel clip.

### MIDI Has No Native Sample Rate

MIDI is event-based, not sample-based. `sampleRate` is **required** on `LoadMidiTracksOptions` — pass the rate of the playlist's `AudioContext` (`getGlobalAudioContext().sampleRate` from playout with the default adapter). Used for sample-based timeline positioning in `createClipFromSeconds()`. The actual audio synthesis sample rate is determined by the `AudioContext` in the playout layer. Never hardcode a default (e.g., 48000) — the real AudioContext rate varies by hardware.

## @tonejs/midi Gotchas

### Tempo Setting — Use `setTempo()` Only

```typescript
// ✅ CORRECT — uses internal serialization
midi.header.setTempo(140);

// ❌ BROKEN — creates invalid binary data, causes infinite loop on re-parse
midi.header.tempos = [{ bpm: 140, ticks: 0 }];
```

Directly assigning `header.tempos` bypasses internal MIDI header serialization and produces binary data that causes `new Midi(data)` to infinite loop. Always use the `setTempo(bpm)` method.

### Time Signature — Push to Array

```typescript
// ✅ CORRECT
midi.header.timeSignatures.push({ ticks: 0, timeSignature: [3, 4], measures: 0 });

// ❌ NO API — there is no setTimeSignature() method
```

### BPM Precision Loss

MIDI stores tempo as microseconds-per-beat (integer). Round-tripping through serialization introduces minor precision loss: `140` → `140.00014000014`. Use `toBeCloseTo()` in tests, not exact equality.

### Velocity Precision Loss

MIDI velocity is a 0-127 integer. `@tonejs/midi` normalizes to 0-1 float, but round-tripping loses precision: `0.9` → `114/127` ≈ `0.8976`. Use `toBeCloseTo()` in tests.

## Testing

**Run:** `cd packages/midi && npx vitest run`

**Environment:** jsdom (kept from the hook tests; `loadMidiTracks.test.ts` works around jsdom's `Blob` having no `arrayBuffer()`). `parser-parity.test.ts` imports `@waveform-playlist/midi` by name, which resolves to `dist`: run `pnpm --filter @waveform-playlist/midi build` after changing `src/index.ts`, or it tests the old build (after `useMidiTracks` was deleted it failed with `Failed to resolve import "react" from "dist/index.mjs"` until the rebuild).

**Test MIDI data:** Created programmatically with `@tonejs/midi`'s `Midi` constructor — no fixture files needed. Use `midi.header.setTempo()` (never direct assignment).

### Flatten Is Visual-Only (Planned)

Flatten merges `midiNotes` into one visual track but keeps separate `ClipTrack` objects per channel for audio playback. Remaining tracks use `hidden: true` so they produce audio without rendering.

**Why not single-track flatten:** Separate `PolySynth` instances per channel create natural chorus/phase thickening. A single synth playing all notes sounds perceptibly thinner, even though all notes are present and polyphony (peak: 19 concurrent) is well within limits (default: 32).

## Dependencies

- **`@tonejs/midi`** — Regular dependency (not peer). Since the parser moved to `@dawcore/midi`, only the tests of this package import it.
- **`@waveform-playlist/core`** — For `MidiNoteData`, `ClipTrack`, `createClipFromSeconds`, `createTrack`.
- No `tone` dependency — this package only does parsing, not playback.

## Program Number (GM Instrument)

`ParsedMidiTrack.programNumber` is set from `track.instrument.number` in `@tonejs/midi`. Passed through `buildMidiTracks` → `clip.midiProgram` → `SoundFontToneTrack` for correct instrument sample lookup. Defaults to 0 (Acoustic Grand Piano). Preserved in flatten mode.

## Dropped File Track Naming

`loadMidiTracks`'s `name` option renames the track and its clip only when the file yields exactly one track; with several, each keeps the MIDI track's own name (e.g., "Piano", "Drums") and is NOT prefixed. This keeps clip headers short in narrow controls.

## Track Naming Logic

`@tonejs/midi` defaults `track.instrument.name` to `"acoustic grand piano"` (program 0) even when no program change event exists. Use `track.instrument.number > 0` to detect explicitly-set instruments. Naming priority:

- Channel 9 → "Drums"
- Program > 0 → title-cased GM name (e.g., "Electric Bass (Finger)")
- Program 0 → track name from MIDI file → "Acoustic Grand Piano" → "Channel N"
