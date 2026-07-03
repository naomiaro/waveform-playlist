# @waveform-playlist/midi

MIDI file loading and parsing for waveform-playlist — fetch a `.mid` file (or use pre-parsed notes) and get back `ClipTrack[]` ready to hand to `WaveformPlaylistProvider`.

This package is the React wrapper over [`@dawcore/midi`](https://www.npmjs.com/package/@dawcore/midi) (the framework-agnostic parser, re-exported here) plus a `useMidiTracks` hook that produces waveform-playlist's clip/track shape. It only handles the data pipeline — `.mid` → notes → `ClipTrack`. Pair it with `@waveform-playlist/browser` for the playlist UI and `@waveform-playlist/playout` (piano-roll rendering + SoundFont/PolySynth playback via Tone.js) for actual MIDI sound.

## Features

- Parse `.mid` files from an `ArrayBuffer` or fetch by URL (`parseMidiFile`, `parseMidiUrl`)
- `useMidiTracks` React hook — loads one or more MIDI configs into `ClipTrack[]` with loading/error state
- Accepts pre-parsed `midiNotes` to skip fetch+parse entirely
- Multi-track MIDI files expand to one `ClipTrack` per track by default, or merge into one with `flatten: true`
- GM instrument naming (percussion detection, program-number lookup) and per-note channel preserved for multi-timbral playback

## Installation

```bash
npm install @waveform-playlist/midi @waveform-playlist/browser
```

`react` is a peer dependency. `@dawcore/midi`, `@tonejs/midi`, and `@waveform-playlist/core` are regular dependencies — installed automatically.

## Usage

```tsx
import { useMidiTracks } from '@waveform-playlist/midi';
import { WaveformPlaylistProvider } from '@waveform-playlist/browser';

function MidiPlaylist() {
  const audioContext = new AudioContext();

  const { tracks, loading, error } = useMidiTracks(
    [{ src: '/music/song.mid', name: 'Piano' }],
    { sampleRate: audioContext.sampleRate }
  );

  if (loading) return <p>Loading MIDI…</p>;
  if (error) return <p>Error: {error}</p>;

  return <WaveformPlaylistProvider tracks={tracks}>{/* your UI */}</WaveformPlaylistProvider>;
}
```

Parsing without React (e.g. a Node script or a custom loader):

```typescript
import { parseMidiFile, parseMidiUrl } from '@waveform-playlist/midi';

const parsed = await parseMidiUrl('/music/song.mid');
console.log(parsed.tracks.map((t) => t.name)); // ['Piano', 'Drums', ...]
```

## API

### `useMidiTracks(configs, options)`

```typescript
function useMidiTracks(
  configs: MidiTrackConfig[],
  options: UseMidiTracksOptions
): UseMidiTracksReturn;

interface MidiTrackConfig {
  src?: string; // URL to a .mid file (fetched + parsed)
  midiNotes?: MidiNoteData[]; // pre-parsed notes — skips fetch+parse
  name?: string;
  muted?: boolean;
  soloed?: boolean;
  volume?: number; // default 1.0
  pan?: number; // default 0
  color?: string;
  startTime?: number; // clip position on timeline, in seconds (default 0)
  duration?: number; // override clip duration in seconds
  flatten?: boolean; // merge all tracks in the file into one ClipTrack (default false)
}

interface UseMidiTracksOptions {
  sampleRate: number; // pass AudioContext.sampleRate — MIDI has no native sample rate
}

interface UseMidiTracksReturn {
  tracks: ClipTrack[];
  loading: boolean;
  error: string | null;
  loadedCount: number;
  totalCount: number;
}
```

### `parseMidiFile(data, options?)` / `parseMidiUrl(url, options?, signal?)`

Re-exported from `@dawcore/midi`.

```typescript
function parseMidiFile(data: ArrayBuffer, options?: ParseMidiOptions): ParsedMidi;
function parseMidiUrl(url: string, options?: ParseMidiOptions, signal?: AbortSignal): Promise<ParsedMidi>;

interface ParseMidiOptions {
  flatten?: boolean; // merge all tracks into one ParsedMidiTrack
}

interface ParsedMidi {
  tracks: ParsedMidiTrack[];
  duration: number; // seconds
  name: string; // song name from MIDI header
  bpm: number; // first tempo in the file (default 120)
  timeSignature: [number, number]; // default [4, 4]
}

interface ParsedMidiTrack {
  name: string;
  notes: MidiNoteData[]; // { midi, name, time, duration, velocity, channel }
  duration: number; // seconds
  channel: number; // 9 = GM percussion
  instrument: string;
  programNumber: number; // GM program number (0-127)
}
```

## Examples & Documentation

- [MIDI guide](https://naomiaro.github.io/waveform-playlist/docs/react/guides/midi) — piano-roll rendering, SoundFont playback, and full walkthrough
- [MIDI example](https://naomiaro.github.io/waveform-playlist/examples/midi)
- [naomiaro.github.io/waveform-playlist](https://naomiaro.github.io/waveform-playlist/)

## License

MIT
