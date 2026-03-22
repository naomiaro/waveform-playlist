# MIDI Package (`@waveform-playlist/midi`)

## Purpose

Provides MIDI file loading, parsing, and React hook integration for waveform-playlist. Separates `@tonejs/midi` (~8-12 KB gzipped) into an opt-in package so users who only need audio don't pay the bundle cost.

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
                                              useMidiTracks │               │
                                                            ▼               ▼
                                                      ClipTrack        ClipTrack
                                                   (clip.midiNotes)  (clip.midiNotes)
                                                            │               │
                                                            └───────┬───────┘
                                                                    ▼
                                                    <WaveformPlaylistProvider tracks={...}>
```

### Two-Layer Design

1. **`parseMidiFile()`** — Pure function, no React. Converts `@tonejs/midi` output to `MidiNoteData[]` format. Can be used standalone (Node.js scripts, non-React apps).

2. **`useMidiTracks()`** — React hook mirroring `useAudioTracks` from `@waveform-playlist/browser`. Handles fetch, parse, and `ClipTrack` construction with loading states.

### Multi-Track Expansion

One MIDI config can produce multiple `ClipTrack` objects. A `.mid` file with N MIDI tracks generates N `ClipTrack`s by default. The `flatten: true` option merges all tracks into one.

The `loadedTracksMap` stores `ClipTrack[]` per config index (not single `ClipTrack`), and `buildTracksArray()` flattens in config order.

### Per-Note Channel Field

`MidiNoteData.channel` (optional, 0-indexed) is set by `mapNotes()` from `track.channel`. This preserves channel identity when `flatten: true` merges all tracks — percussion notes (channel 9) remain routable to percussion synths in `MidiToneTrack` even in a mixed-channel clip.

### MIDI Has No Native Sample Rate

MIDI is event-based, not sample-based. `sampleRate` is **required** on `UseMidiTracksOptions` (second arg to `useMidiTracks()`) — pass `getGlobalAudioContext().sampleRate` from playout. Used for sample-based timeline positioning in `createClipFromSeconds()`. The actual audio synthesis sample rate is determined by the `AudioContext` in the playout layer. Never hardcode a default (e.g., 48000) — the real AudioContext rate varies by hardware.

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

**Test count:** 20 tests (8 parser + 12 hook)

**Environment:** jsdom (required for `@testing-library/react` in hook tests)

**Test MIDI data:** Created programmatically with `@tonejs/midi`'s `Midi` constructor — no fixture files needed. Use `midi.header.setTempo()` (never direct assignment).

**Hook test stability:** Config arrays must be declared outside `renderHook()` callbacks to maintain stable references. Inline arrays create new references on each render, causing `useEffect` to re-run infinitely.

```typescript
// ✅ Stable reference
const configs: MidiTrackConfig[] = [{ midiNotes: notes, name: 'Test' }];
const { result } = renderHook(() => useMidiTracks(configs, { sampleRate: 48000 }));

// ❌ New reference each render — infinite effect loop
const { result } = renderHook(() => useMidiTracks([{ midiNotes: notes }], { sampleRate: 48000 }));
```

### Flatten Is Visual-Only (Planned)

Flatten merges `midiNotes` into one visual track but keeps separate `ClipTrack` objects per channel for audio playback. Remaining tracks use `hidden: true` so they produce audio without rendering.

**Why not single-track flatten:** Separate `PolySynth` instances per channel create natural chorus/phase thickening. A single synth playing all notes sounds perceptibly thinner, even though all notes are present and polyphony (peak: 19 concurrent) is well within limits (default: 32).

## Dependencies

- **`@tonejs/midi`** — Regular dependency (not peer). The whole reason this package exists.
- **`@waveform-playlist/core`** — For `MidiNoteData`, `ClipTrack`, `createClipFromSeconds`, `createTrack`.
- **`react`** — Peer dependency (for `useMidiTracks` hook).
- No `tone` dependency — this package only does parsing, not playback.

## Program Number (GM Instrument)

`ParsedMidiTrack.programNumber` is set from `track.instrument.number` in `@tonejs/midi`. Passed through `useMidiTracks` → `clip.midiProgram` → `SoundFontToneTrack` for correct instrument sample lookup. Defaults to 0 (Acoustic Grand Piano). Preserved in flatten mode.

## Dropped File Track Naming

When a MIDI config has a `name` and the file contains multiple tracks, `useMidiTracks` uses the MIDI track's own name directly (e.g., "Piano", "Drums") — it does NOT prefix with the config name. This keeps clip headers short in narrow controls.

## Track Naming Logic

`@tonejs/midi` defaults `track.instrument.name` to `"acoustic grand piano"` (program 0) even when no program change event exists. Use `track.instrument.number > 0` to detect explicitly-set instruments. Naming priority:
- Channel 9 → "Drums"
- Program > 0 → title-cased GM name (e.g., "Electric Bass (Finger)")
- Program 0 → track name from MIDI file → "Acoustic Grand Piano" → "Channel N"
