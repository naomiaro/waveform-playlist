---
sidebar_position: 10
description: "Load MIDI files for piano roll visualization with SoundFont or synthesized playback"
---

# MIDI Playback

Waveform Playlist supports MIDI file loading and playback in two flavors:

- **React** — the `@waveform-playlist/midi` package provides the `useMidiTracks` hook, which integrates with `WaveformPlaylistProvider`.
- **Web Components** — `<daw-editor>` from `@dawcore/components` exposes an `editor.loadMidi(source, options)` method, backed by the optional `@dawcore/midi` peer dep.

Both paths use the same framework-agnostic parser (`@dawcore/midi`) under the hood — the React package re-exports it. MIDI tracks render as piano roll visualizations and play back using SoundFont samples or Tone.js PolySynth synthesis.

## React

### Installation

```bash
npm install @waveform-playlist/midi @tonejs/midi
```

`@tonejs/midi` and `@dawcore/midi` are regular dependencies and will be installed automatically. The package is separate from the core library so users who only need audio don't pay the bundle cost (~8-12 KB gzipped).

### Basic Usage

Use the `useMidiTracks` hook to load `.mid` files:

```tsx
import { useMidiTracks } from '@waveform-playlist/midi';
import { WaveformPlaylistProvider, Waveform, PlayButton, StopButton } from '@waveform-playlist/browser';

function MidiPlayer() {
  const { tracks, loading, error } = useMidiTracks(
    [{ src: '/music/song.mid' }],
    { sampleRate: 48000 },
  );

  if (loading) return <div>Loading MIDI...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <WaveformPlaylistProvider tracks={tracks} controls={{ show: true, width: 200 }}>
      <PlayButton /> <StopButton />
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

A single `.mid` file typically produces multiple `ClipTrack` objects — one per MIDI channel (e.g., Piano, Bass, Drums). All tracks are returned at once after loading completes.

### MidiTrackConfig Options

```typescript
interface MidiTrackConfig {
  src?: string;               // URL to .mid file
  midiNotes?: MidiNoteData[]; // Pre-parsed notes (skip fetch+parse)
  name?: string;              // Track display name
  muted?: boolean;
  soloed?: boolean;
  volume?: number;            // Default: 1.0
  pan?: number;               // Default: 0
  color?: string;
  startTime?: number;         // Clip position in seconds (default: 0)
  duration?: number;          // Override clip duration in seconds
  flatten?: boolean;          // Merge all MIDI tracks into one (default: false)
}

interface UseMidiTracksOptions {
  sampleRate: number;         // Required — pass AudioContext.sampleRate
}
```

### Pre-Parsed Notes

If you already have note data (e.g., from a custom parser or algorithm), skip the fetch step:

```tsx
const { tracks } = useMidiTracks(
  [
    {
      midiNotes: [
        { midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 },
        { midi: 64, name: 'E4', time: 0.5, duration: 0.5, velocity: 0.7 },
      ],
      name: 'Melody',
      duration: 4,
    },
  ],
  { sampleRate: 48000 },
);
```

### Flatten Mode

By default, each MIDI channel becomes a separate track. Use `flatten: true` to merge all channels into one visual track:

```tsx
const { tracks } = useMidiTracks(
  [{ src: '/music/song.mid', flatten: true }],
  { sampleRate: 48000 },
);
```

### SoundFont Playback

For realistic instrument sounds, load a SoundFont file and pass the cache to the provider:

```tsx
import { SoundFontCache } from '@waveform-playlist/playout';

// Load the SoundFont (do this once, e.g., in a hook or effect).
// fromUrl resolves only after the file is fetched and parsed.
const cache = await SoundFontCache.fromUrl('/soundfonts/piano.sf2');

// Pass to provider — MIDI tracks automatically use the SoundFont samples
<WaveformPlaylistProvider
  tracks={tracks}
  soundFontCache={cache}
>
  <Waveform />
</WaveformPlaylistProvider>
```

Without a `soundFontCache`, MIDI tracks fall back to Tone.js PolySynth synthesis. SoundFont playback uses the `midiProgram` field on each clip to select the correct instrument samples.

#### Loading the SoundFont late

The SoundFont decision is made per-track when tracks are set up. If the `.sf2`
file finishes downloading *after* the playlist mounted, just pass the cache to
the provider when it's ready — the provider forwards it to the live adapter,
which upgrades MIDI tracks from PolySynth to samples in place:

```tsx
const [cache, setCache] = useState<SoundFontCache | undefined>(undefined);

useEffect(() => {
  SoundFontCache.fromUrl('/media/soundfont/A320U.sf2')
    .then(setCache)
    .catch((err) => {
      console.error('SoundFont failed to load — MIDI stays on PolySynth:', err);
    });
}, []);

<WaveformPlaylistProvider soundFontCache={cache} tracks={tracks} />
```

With `fromUrl` an unloaded cache never reaches your state. The provider reacts to the
prop's reference changing — passing the cache eagerly and calling `load()` on
the same object later won't re-trigger the upgrade (you'd see a
`"SoundFont not loaded"` console warning instead).

For non-React consumers (e.g. `<daw-editor>` web components), the same
capability is `adapter.setSoundFontCache(cache)` on the adapter returned by
`createToneAdapter()`.

### Mixing MIDI and Audio Tracks

MIDI and audio tracks can be played together. Both `useMidiTracks` and `useAudioTracks` return `ClipTrack[]`, so merge them into a single array:

```tsx
import { useMidiTracks } from '@waveform-playlist/midi';
import { useAudioTracks, WaveformPlaylistProvider, Waveform } from '@waveform-playlist/browser';

function MixedPlayer() {
  const { tracks: midiTracks, loading: midiLoading } = useMidiTracks(
    [{ src: '/music/song.mid' }],
    { sampleRate: 48000 },
  );

  const { tracks: audioTracks, loading: audioLoading } = useAudioTracks([
    { src: '/audio/vocals.mp3', name: 'Vocals' },
  ]);

  if (midiLoading || audioLoading) return <div>Loading...</div>;

  const allTracks = [...midiTracks, ...audioTracks];

  return (
    <WaveformPlaylistProvider tracks={allTracks}>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

## Web Components

For consumers of `<daw-editor>` (the dawcore Web Components layer), call `editor.loadMidi(source, options)`. This creates one `<daw-track>` element per note-bearing MIDI track, each with `render-mode="piano-roll"` set automatically.

### Installation

```bash
npm install @dawcore/components @dawcore/midi
```

`@dawcore/midi` is declared as an optional peer dep on `@dawcore/components` — install it only if you want to use `editor.loadMidi`. The editor dynamic-imports it on first call.

### Basic Usage

```html
<daw-editor id="editor"></daw-editor>

<script type="module">
  import '@dawcore/components';
  import { createToneAdapter } from '@waveform-playlist/playout';

  const editor = document.getElementById('editor');
  editor.adapter = createToneAdapter({ ppqn: 960 });

  const result = await editor.loadMidi('/music/song.mid');
  console.log('Loaded', result.trackIds.length, 'tracks at', result.bpm, 'bpm');

  // Apply tempo / time signature from the file (caller decides — loadMidi
  // never mutates editor state implicitly)
  editor.bpm = result.bpm;
  editor.timeSignature = result.timeSignature;
</script>
```

### API

```typescript
editor.loadMidi(source: string | File, options?: MidiLoadOptions): Promise<MidiLoadResult>;

interface MidiLoadOptions {
  startTime?: number;       // Timeline position in seconds (default 0)
  signal?: AbortSignal;     // Forwarded to fetch only — see "AbortSignal scope" below
}

interface MidiLoadResult {
  readonly trackIds: readonly string[];
  readonly bpm: number;
  readonly timeSignature: readonly [number, number];
  readonly duration: number;
  readonly name: string;
}
```

### File-Picker Loading

`source` accepts either a URL string or a `File` object — same return shape:

```html
<input id="picker" type="file" accept=".mid,.midi" />
<script type="module">
  document.getElementById('picker').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) await editor.loadMidi(file);
  });
</script>
```

### Cleanup-on-Failure

If any per-track creation fails, every `<daw-track>` appended during the call is removed — including elements that `addTrack` left in the DOM before its promise rejected. The editor returns to its pre-call state. Don't worry about orphan tracks on partial failure.

### AbortSignal Scope

`options.signal` is forwarded to `fetch()` for URL sources only. Aborting after parsing has finished does NOT cancel the in-flight `addTrack` calls (a documented v1 limitation). Cancellation typically surfaces as a `DOMException` named `AbortError` — distinguish it from a real failure:

```javascript
try {
  await editor.loadMidi(url, { signal: controller.signal });
} catch (err) {
  if (err.name === 'AbortError') return; // user cancelled — not an error
  console.error('loadMidi failed', err);
}
```

### Install Hint

If `@dawcore/midi` isn't installed, `loadMidi` rejects with a friendly install hint (and `console.warn`s the original module-resolution error so debugging isn't blocked when the failure is something other than "not installed" — broken exports map, 404 chunk, CSP block, etc.).

## Pure Parsing (No React, No DOM)

The `parseMidiFile` function works without React or web components — useful for Node.js scripts, build-time tooling, or non-React apps. It lives in `@dawcore/midi` (re-exported from `@waveform-playlist/midi`).

```typescript
import { parseMidiFile } from '@dawcore/midi';
// or, equivalently from the React package re-export:
// import { parseMidiFile } from '@waveform-playlist/midi';

const response = await fetch('/music/song.mid');
const buffer = await response.arrayBuffer();
const parsed = parseMidiFile(buffer);

console.log(parsed.name);           // Song name
console.log(parsed.bpm);            // Tempo (first tempo only for multi-tempo files)
console.log(parsed.tracks.length);  // Number of tracks

for (const track of parsed.tracks) {
  console.log(track.name, track.notes.length, 'notes');
}
```

There's also `parseMidiUrl` for a fetch+parse convenience:

```typescript
import { parseMidiUrl } from '@dawcore/midi';

const parsed = await parseMidiUrl('/music/song.mid');
```

## Track Naming

Track names are derived from the MIDI file content:

- **Channel 9** → "Drums" (GM percussion convention)
- **Program > 0** → Title-cased GM instrument name (e.g., "Electric Bass (Finger)")
- **Program 0** → Track name from the MIDI file, or "Acoustic Grand Piano", or "Channel N"

When loading user-dropped files with a config `name`, individual track names from the MIDI file are used directly (not prefixed with the config name).
