# @waveform-playlist/midi

MIDI file loading and parsing for waveform-playlist — load a `.mid` file and get back `ClipTrack[]` ready to add to the arrangement that `WaveformPlaylistProvider` plays.

This package adds `loadMidiTracks` to [`@dawcore/midi`](https://www.npmjs.com/package/@dawcore/midi) (the framework-agnostic parser, re-exported here): a function that produces waveform-playlist's clip/track shape. It only handles the data pipeline — `.mid` → notes → `ClipTrack`. Pair it with `@waveform-playlist/browser` for the playlist UI and `@waveform-playlist/playout` (piano-roll rendering + SoundFont/PolySynth playback via Tone.js) for actual MIDI sound.

## Features

- Parse `.mid` files from an `ArrayBuffer` or fetch by URL (`parseMidiFile`, `parseMidiUrl`)
- `loadMidiTracks` function — loads a URL, a `File` or a `Blob` as `ClipTrack[]`, no React state
- Multi-track MIDI files expand to one `ClipTrack` per track by default, or merge into one with `flatten: true`
- GM instrument naming (percussion detection, program-number lookup) and per-note channel preserved for multi-timbral playback

## Installation

```bash
npm install @waveform-playlist/midi @waveform-playlist/browser
```

`@dawcore/midi`, `@tonejs/midi`, and `@waveform-playlist/core` are regular dependencies — installed automatically. The package has no peer dependencies; the example below uses React and `@waveform-playlist/browser`.

## Usage

```tsx
import { useEffect, useState } from 'react';
import { loadMidiTracks } from '@waveform-playlist/midi';
import { WaveformPlaylistProvider, useCreateArrangement } from '@waveform-playlist/browser';

function MidiPlaylist() {
  // Starts empty; the MIDI tracks are added once the file has loaded
  const arrangement = useCreateArrangement();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadMidiTracks('/music/song.mid', { sampleRate: 48000, name: 'Piano', signal: controller.signal })
      .then((tracks) => {
        if (arrangement.getTracks().length === 0) {
          tracks.forEach((track) => arrangement.addTrack(track));
          arrangement.clearHistory(); // the first load is not an undo step
        }
        setLoaded(true);
      })
      .catch((err: unknown) => {
        // An abort (unmount, StrictMode's first run) is not an error
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : String(err));
      });
    return () => controller.abort();
  }, [arrangement]);

  if (error) return <p>Error: {error}</p>;
  if (!loaded) return <p>Loading MIDI…</p>;

  // Rendered once the tracks are in: the playlist's ready happens once per mount
  return (
    <WaveformPlaylistProvider arrangement={arrangement} sampleRate={48000}>
      {/* your UI */}
    </WaveformPlaylistProvider>
  );
}
```

`sampleRate` positions the clips in samples: pass the rate of the playlist's `AudioContext`.

Parsing without React (e.g. a Node script or a custom loader):

```typescript
import { parseMidiFile, parseMidiUrl } from '@waveform-playlist/midi';

const parsed = await parseMidiUrl('/music/song.mid');
console.log(parsed.tracks.map((t) => t.name)); // ['Piano', 'Drums', ...]
```

## API

### `loadMidiTracks(src, options)`

A function, not a hook: no React state. `src` is a URL string, a `File` or a `Blob`; it resolves to `ClipTrack[]` with `kind: 'midi'`, and every call makes new track and clip ids.

```typescript
function loadMidiTracks(src: string | File | Blob, options: LoadMidiTracksOptions): Promise<ClipTrack[]>;

interface LoadMidiTracksOptions {
  sampleRate: number; // required — pass AudioContext.sampleRate
  flatten?: boolean; // merge all tracks in the file into one ClipTrack (default false)
  start?: number; // clip position on timeline, in seconds (default 0)
  duration?: number; // clip duration in seconds (default: end of the track's last note)
  name?: string; // names the track and its clip when the file yields exactly one track
  signal?: AbortSignal; // an aborted signal rejects with the signal's reason
}
```

A URL that does not answer with an OK status rejects with `Failed to fetch MIDI file <url>: <status>`, with the status text after the code when there is one (`Failed to fetch MIDI file /missing.mid: 404 Not Found`); data that is not a MIDI file rejects with `parseMidiFile: invalid or corrupt MIDI data (<n> bytes): …`.

The `useMidiTracks` hook of earlier versions was removed; the [upgrade guide](https://naomiaro.github.io/waveform-playlist/docs/react/upgrading) has the replacement for each of its options.

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
