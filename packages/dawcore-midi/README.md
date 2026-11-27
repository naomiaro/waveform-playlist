# @dawcore/midi

Framework-agnostic MIDI file parsing, and loading a `.mid` file as waveform-playlist tracks. No React, no DOM, no Lit — plain functions built on `@tonejs/midi`.

Used by `@dawcore/components` (the Lit web component layer, via `editor.loadMidi()`) and by React apps on `@waveform-playlist/browser` (`loadMidiTracks`, whose tracks go into the arrangement). It replaces `@waveform-playlist/midi`, which is no longer published: the names are the same, only the import changes.

## Installation

```bash
npm install @dawcore/midi
```

No peer dependencies; `@tonejs/midi` and `@waveform-playlist/core` are regular dependencies. `@dawcore/components` declares this package as an *optional* peer dependency — add it to your own dependencies to enable `editor.loadMidi()` (it's dynamic-imported on first call, so non-MIDI users ship zero parser bytes).

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

## Loading tracks for an arrangement

`loadMidiTracks(src, options)` loads a URL, a `File` or a `Blob` as `ClipTrack[]` with `kind: 'midi'`, one track per MIDI track of the file (one in all with `flatten`). It is a function, not a hook: the app keeps its own loading and error state and adds the tracks to the arrangement that `WaveformPlaylistProvider` plays. Every call makes new track and clip ids.

```tsx
import { useEffect, useState } from 'react';
import { loadMidiTracks } from '@dawcore/midi';
import { WaveformPlaylistProvider, useCreateArrangement } from '@waveform-playlist/browser';

function MidiPlaylist() {
  // Starts empty; the MIDI tracks are added once the file has loaded
  const arrangement = useCreateArrangement();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadMidiTracks('/music/song.mid', { sampleRate: 48000, signal: controller.signal })
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

`sampleRate` positions the clips in samples: pass the rate of the playlist's `AudioContext` (48000 here: the provider's `sampleRate` prop creates its AudioContext at that rate). Playing the notes (piano roll, SoundFont or PolySynth) is `@waveform-playlist/browser` with `@waveform-playlist/playout`; see the MIDI guide.

## API

- `parseMidiFile(data: ArrayBuffer, options?)` — parse MIDI data into `ParsedMidi`
- `parseMidiUrl(url: string, options?, signal?)` — fetch and parse a `.mid` URL
- Options: `{ flatten?: boolean }` — merge all MIDI tracks into a single track
- `loadMidiTracks(src: string | File | Blob, options: LoadMidiTracksOptions)` — a file as `kind: 'midi'` tracks:

```typescript
interface LoadMidiTracksOptions {
  sampleRate: number; // required — pass AudioContext.sampleRate
  flatten?: boolean; // merge all tracks in the file into one ClipTrack (default false)
  start?: number; // clip position on timeline, in seconds (default 0)
  duration?: number; // clip duration in seconds (default: end of the track's last note)
  name?: string; // names the track and its clip when the file yields exactly one track
  signal?: AbortSignal; // an aborted signal rejects with the signal's reason
}
```

- Types: `ParsedMidi`, `ParsedMidiTrack`, `ParseMidiOptions`, `LoadMidiTracksOptions`, `MidiLoadOptions`, `MidiLoadResult`

A URL that does not answer with an OK status rejects with `Failed to fetch MIDI file <url>: <status>`, with the status text after the code when there is one (`Failed to fetch MIDI file /missing.mid: 404 Not Found`); data that is not a MIDI file rejects with `parseMidiFile: invalid or corrupt MIDI data (<n> bytes): …`.

Coming from `@waveform-playlist/midi`: change the import. Its `useMidiTracks` hook (13.x) was removed; the [upgrade guide](https://naomiaro.github.io/waveform-playlist/docs/react/upgrading) has the replacement for each of its options.

## Examples & Documentation

- [`examples/dawcore-tone/midi-load.html`](https://github.com/naomiaro/waveform-playlist/blob/main/examples/dawcore-tone/midi-load.html) — loading a `.mid` file (URL or file input) into `<daw-editor>` via `editor.loadMidi()`, with cancellation (`pnpm example:dawcore-tone`)
- [MIDI guide](https://naomiaro.github.io/waveform-playlist/docs/react/guides/midi) — covers both the React (`loadMidiTracks`) and Web Components (`editor.loadMidi()`) paths, which both use this package
- [MIDI example](https://naomiaro.github.io/waveform-playlist/examples/midi)

## License

MIT
