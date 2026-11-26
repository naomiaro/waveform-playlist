---
sidebar_position: 10
description: "Load MIDI files for piano roll visualization with SoundFont or synthesized playback"
---

# MIDI Playback

Waveform Playlist supports MIDI file loading and playback in two flavors:

- **React** — the `@waveform-playlist/midi` package provides `loadMidiTracks`, which loads a `.mid` file as tracks for the arrangement of `WaveformPlaylistProvider`.
- **Web Components** — `<daw-editor>` from `@dawcore/components` exposes an `editor.loadMidi(source, options)` method, backed by the optional `@dawcore/midi` peer dep.

Both paths use the same framework-agnostic parser (`@dawcore/midi`) under the hood — the React package re-exports it. MIDI tracks render as piano roll visualizations and play back using SoundFont samples or Tone.js PolySynth synthesis.

## React

### Installation

```bash
npm install @waveform-playlist/midi @tonejs/midi
```

`@tonejs/midi` and `@dawcore/midi` are regular dependencies and will be installed automatically. The package is separate from the core library so users who only need audio don't pay the bundle cost (~8-12 KB gzipped).

### Basic Usage

Load the `.mid` file with `loadMidiTracks`, add its tracks to the arrangement, and render the provider once they are in:

```tsx
import { useEffect, useState } from 'react';
import { loadMidiTracks } from '@waveform-playlist/midi';
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  StopButton,
  useCreateArrangement,
} from '@waveform-playlist/browser';

function MidiPlayer() {
  // Starts empty: the MIDI tracks are added once the file has loaded
  const arrangement = useCreateArrangement();
  const [status, setStatus] = useState<'loading' | 'loaded' | string>('loading');

  useEffect(() => {
    const controller = new AbortController();
    loadMidiTracks('/music/song.mid', { sampleRate: 48000, signal: controller.signal })
      .then((tracks) => {
        // An effect run again (StrictMode, Fast Refresh) must not add them twice
        if (arrangement.getTracks().length === 0) {
          tracks.forEach((track) => arrangement.addTrack(track));
          arrangement.clearHistory(); // the first load is not an undo step
        }
        setStatus('loaded');
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setStatus(err instanceof Error ? err.message : String(err));
      });
    return () => controller.abort();
  }, [arrangement]);

  if (status === 'loading') return <div>Loading MIDI...</div>;
  if (status !== 'loaded') return <div>Error: {status}</div>;

  return (
    <WaveformPlaylistProvider arrangement={arrangement} sampleRate={48000}>
      <PlayButton /> <StopButton />
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

The provider is rendered after the tracks are in because the playlist's [ready](/docs/react/guides/loading-audio#ready) happens once per mount and waits only for audio sources: a provider mounted over the empty arrangement would be ready at once. A dropped `.mid` file later is `loadMidiTracks(file, …)` followed by `arrangement.addTrack(track)` for each track, an undo step like any added track.

`sampleRate` is the rate the clips are positioned at: pass the rate of the provider's `AudioContext` (48000 here, set with the provider's `sampleRate` prop).

A single `.mid` file typically produces multiple `ClipTrack` objects — one per MIDI track of the file (e.g., Piano, Bass, Drums).

### loadMidiTracks

`loadMidiTracks` is a plain function: it takes a URL, a `File` or a `Blob` and resolves to `ClipTrack[]` (`kind: 'midi'`, new ids on every call), with no React state. `sampleRate` is required.

```tsx
import { loadMidiTracks } from '@waveform-playlist/midi';

const controller = new AbortController();
const tracks = await loadMidiTracks(file, {
  sampleRate: audioContext.sampleRate,
  signal: controller.signal,
});
tracks.forEach((track) => arrangement.addTrack(track));
```

The other options are `flatten` (merge all MIDI tracks of the file into one), `start` and `duration` (both in seconds) and `name`, which names the track and its clip only when the file yields exactly one track (several tracks keep their own MIDI names). An aborted `signal` rejects with the signal's reason. A URL that does not answer with an OK status rejects with `Failed to fetch MIDI file <url>: <status>`, with the status text after the code when there is one (`Failed to fetch MIDI file /missing.mid: 404 Not Found`), and data that is not a MIDI file rejects with `parseMidiFile: invalid or corrupt MIDI data (<n> bytes): …`.

### MIDI Tracks

Every track `loadMidiTracks` returns is a MIDI track (`kind: 'midi'`). A track holds one kind of clip: MIDI clips go on MIDI tracks and audio clips on audio tracks, so put a `.mid` part and an audio stem on separate tracks. A MIDI track is always drawn as a piano roll.

If you build a MIDI track yourself, set the kind:

```tsx
import { createTrack } from '@waveform-playlist/core';

const keys = createTrack({ name: 'Keys', kind: 'midi', clips: [midiClip] });
```

The arrangement refuses a track whose clips do not match its kind, and a clip that is still loading (an audio clip naming its `src`) on a MIDI track. The throw reaches the caller: from the `useCreateArrangement` initializer it is a render error for an error boundary, from `arrangement.addTrack()` it is your handler's exception (see [Where Errors Land](/docs/react/guides/loading-audio#where-errors-land)).

### Pre-Parsed Notes

If you already have note data (e.g., from a custom parser or algorithm), build the clip and the track with `@waveform-playlist/core`:

```tsx
import { createClipFromSeconds, createTrack } from '@waveform-playlist/core';

const melody = createTrack({
  name: 'Melody',
  kind: 'midi',
  clips: [
    createClipFromSeconds({
      startTime: 0,
      duration: 4,
      sampleRate: 48000,
      sourceDuration: 4,
      name: 'Melody',
      midiNotes: [
        { midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 },
        { midi: 64, name: 'E4', time: 0.5, duration: 0.5, velocity: 0.7 },
      ],
    }),
  ],
});

const arrangement = useCreateArrangement(() => [melody]);
```

### Flatten Mode

By default, each MIDI track of the file becomes a separate track. Use `flatten: true` to merge them into one:

```tsx
const tracks = await loadMidiTracks('/music/song.mid', { sampleRate: 48000, flatten: true });
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
  arrangement={arrangement}
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

<WaveformPlaylistProvider soundFontCache={cache} arrangement={arrangement} />
```

With `fromUrl` an unloaded cache never reaches your state. The provider reacts to the
prop's reference changing — passing the cache eagerly and calling `load()` on
the same object later won't re-trigger the upgrade (you'd see a
`"SoundFont not loaded"` console warning instead).

For non-React consumers (e.g. `<daw-editor>` web components), the same
capability is `adapter.setSoundFontCache(cache)` on the adapter returned by
`createToneAdapter()`.

### Mixing MIDI and Audio Tracks

MIDI and audio tracks can be played together: they are tracks of one arrangement. Declare the audio in the initializer and add the MIDI tracks once they have loaded:

```tsx
import { useEffect, useState } from 'react';
import { loadMidiTracks } from '@waveform-playlist/midi';
import { useCreateArrangement } from '@waveform-playlist/browser';
import { audioTrack } from '@waveform-playlist/core';

function useMixedArrangement() {
  const arrangement = useCreateArrangement(() => [
    audioTrack({ src: '/audio/vocals.mp3', name: 'Vocals' }),
  ]);
  // Shown by the page: the MIDI file could not be loaded (the audio plays on)
  const [midiError, setMidiError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadMidiTracks('/music/song.mid', { sampleRate: 48000, signal: controller.signal })
      .then((tracks) => tracks.forEach((track) => arrangement.addTrack(track)))
      .catch((err: unknown) => {
        // An abort (unmount, StrictMode's first run) is not an error
        if (!controller.signal.aborted) setMidiError(err instanceof Error ? err.message : String(err));
      });
    return () => controller.abort();
  }, [arrangement]);

  return { arrangement, midiError };
}
```

Here the MIDI tracks may arrive after the playlist's first ready (which waits for the vocals); they are added to the playing arrangement as they come. To have them in before the provider mounts, load them first as in [Basic Usage](#basic-usage).

## Web Components

For consumers of `<daw-editor>` (the dawcore Web Components layer), call `editor.loadMidi(source, options)`. This creates one `<daw-track>` element per note-bearing MIDI track, each a MIDI track (`kind="midi"`), drawn as a piano roll.

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

If any per-track creation fails, every track the call added is removed (`addTrack` creates no `<daw-track>` element since #848; a track whose `addTrack` rejected never entered). No orphan tracks are left on partial failure. Each removal is an undo step, so the undo history is not rewound to before the call.

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
