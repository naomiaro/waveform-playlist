# @dawcore/midi

Framework-agnostic MIDI file loading and parsing for the dawcore family. No React, no DOM, no Lit — pure functions built on `@tonejs/midi`.

Used by `@dawcore/components` (the Lit web component layer, via `editor.loadMidi()`) and `@waveform-playlist/midi` (the React `useMidiTracks` hook).

## Installation

```bash
npm install @dawcore/midi
```

No peer dependencies. `@dawcore/components` declares this package as an *optional* peer dependency — add it to your own dependencies to enable `editor.loadMidi()` (it's dynamic-imported on first call, so non-MIDI users ship zero parser bytes).

## Quick Start

```typescript
import { parseMidiUrl, parseMidiFile } from '@dawcore/midi';

// Fetch and parse a .mid URL (optional AbortSignal for cancellation)
const midi = await parseMidiUrl('/media/song.mid');
// midi: { tracks, duration, name, bpm, timeSignature }

for (const track of midi.tracks) {
  // track: { name, notes, duration, channel, instrument, programNumber }
  console.log(track.name, track.notes.length + ' notes');
}

// Or parse an ArrayBuffer you already have (e.g. from a File input)
const buffer = await file.arrayBuffer();
const parsed = parseMidiFile(buffer, { flatten: true }); // merge all tracks into one
```

Note timings are in seconds, already tempo-adjusted by `@tonejs/midi`. Tracks without notes are filtered out.

## API

- `parseMidiFile(data: ArrayBuffer, options?)` — parse MIDI data into `ParsedMidi`
- `parseMidiUrl(url: string, options?, signal?)` — fetch and parse a `.mid` URL
- Options: `{ flatten?: boolean }` — merge all MIDI tracks into a single track
- Types: `ParsedMidi`, `ParsedMidiTrack`, `ParseMidiOptions`, `MidiLoadOptions`, `MidiLoadResult`

## Examples & Documentation

- [`examples/dawcore-tone/`](https://github.com/naomiaro/waveform-playlist/tree/main/examples/dawcore-tone) — MIDI piano-roll rendering and playback (`pnpm example:dawcore-tone`)
- Guides: [naomiaro.github.io/waveform-playlist](https://naomiaro.github.io/waveform-playlist/docs/web-components/getting-started)

## License

MIT
