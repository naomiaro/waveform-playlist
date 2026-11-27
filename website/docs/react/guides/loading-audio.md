---
sidebar_position: 1
description: "Load audio files, AudioBuffers, dropped files and pre-computed waveform data into a Waveform Playlist arrangement"
---

# Loading Audio

The tracks of a multitrack playlist belong to an **arrangement**: the object that owns the tracks and their clips, the mix, the undo history, and the loading of the audio the clips name. You make it with `useCreateArrangement`, give it to `WaveformPlaylistProvider`, and change it through its methods. A clip can name its audio (a URL or a file) instead of carrying it; the arrangement fetches and decodes it, and the clip becomes playable when its audio has arrived.

## Basic Loading

Declare the tracks in the initializer of `useCreateArrangement`. `audioTrack()` from `@waveform-playlist/core` builds a track with one clip that names its audio:

```tsx
import { WaveformPlaylistProvider, Waveform, useCreateArrangement } from '@waveform-playlist/browser';
import { audioTrack } from '@waveform-playlist/core';

function MyPlaylist() {
  // One arrangement per component instance; the initializer runs on the first render only
  const arrangement = useCreateArrangement(() => [
    audioTrack({ src: '/audio/track1.mp3', name: 'Track 1' }),
    audioTrack({ src: '/audio/track2.wav', name: 'Track 2', start: 4 }),
  ]);

  return (
    <WaveformPlaylistProvider arrangement={arrangement}>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

The playlist is drawn at once, with a row and controls for every track. Nothing is fetched until the provider has its first adapter (the default Tone.js adapter, or the one `createAdapter` returns): the provider then gives the arrangement its `AudioContext` to decode with, and each file is fetched and decoded once. A clip is drawn when its audio has decoded, or before that as a [placeholder](#placeholders-while-audio-loads) when its length is known.

The initializer and the options of `useCreateArrangement` are read once. A later render with other values changes nothing: change the arrangement through its methods (below). Keep the same arrangement for the life of the playlist: a new `arrangement` object passed to the provider mounts everything below it again.

## `audioTrack()` Options

```tsx
interface AudioTrackOptions {
  id?: string;               // Track id (default: generated). Must be unique in the arrangement
  clipId?: string;           // Id of the clip (default: generated)
  name?: string;             // Track name (default: the file name of src without its extension, else 'Untitled')
  src?: ClipSource;          // The audio to load: a URL string, a Blob or a File
  audioBuffer?: AudioBuffer; // Audio already in memory: nothing is fetched
  waveformData?: WaveformDataObject; // Pre-computed peaks (BBC audiowaveform)
  start?: number;            // Position on the timeline, in seconds (default 0)
  duration?: number;         // Clip duration in seconds (default: the whole source from offset)
  offset?: number;           // Start within the source, in seconds (default 0)
  fadeIn?: Fade;
  fadeOut?: Fade;
  gain?: number;             // Clip gain (default 1)
  color?: string;            // Waveform color (track and clip)
  volume?: number;           // Initial volume 0-1 (default 1)
  muted?: boolean;           // Start muted (default false)
  soloed?: boolean;          // Start soloed (default false)
  pan?: number;              // Pan -1 to 1 (default 0)
  panLaw?: PanLaw;           // 'mono' | 'stereo' (default: the track's first audio decides)
  renderMode?: RenderMode;   // 'waveform' | 'spectrogram' | 'both'
  spectrogramConfig?: SpectrogramConfig;
  spectrogramColorMap?: ColorMapValue;
}
```

- With `src` and no `audioBuffer`, the clip is a `LoadingClip`: it names its audio, and the arrangement loads it.
- With `audioBuffer` (with or without `src`), or with `waveformData` and no `src`, the clip is an `AudioClip` built at once.
- With none of the three, `audioTrack()` throws `audioTrack: give src, audioBuffer or waveformData`. A negative or non-finite `start` or `offset`, or a `duration` that is not a positive number, throws too.
- A `duration` that runs past the end of the audio is cut to it, with a console warning.

The mixer fields (`volume`, `muted`, `soloed`, `pan`) are the values a track enters with. After that the arrangement keeps the mix by track id, and you change it with the mixer setters (`useEditorControls().setTrackVolume(trackId, 0.5)`, `arrangement.setTrackVolume(trackId, 0.5)`).

## Several Clips per Track

A track can hold several clips, each naming a part of a file in seconds. Write the clips as `LoadingClip` objects on an `ArrangementTrack`:

```tsx
import { useCreateArrangement } from '@waveform-playlist/browser';
import { createTrack, type ArrangementTrack, type LoadingClip } from '@waveform-playlist/core';

const buildTracks = (): ArrangementTrack[] => {
  const clips: LoadingClip[] = [
    { id: 'synth-a', src: '/audio/synth.mp3', start: 0, duration: 4, offset: 0 },
    { id: 'synth-b', src: '/audio/synth.mp3', start: 8, duration: 4, offset: 4 },
  ];
  return [{ ...createTrack({ name: 'Synth' }), clips }];
};

function MultiClipPlaylist() {
  const arrangement = useCreateArrangement(buildTracks);
  // ...
}
```

One URL is one source however many clips name it: it is fetched once, and every clip that names it becomes playable when it has decoded. Give each clip of a track its own `id`. While its audio loads, a clip cannot be moved, trimmed or split; the clips that have loaded can, and they do not collide with it.

## Adding Tracks at Runtime

Change the arrangement through its methods, from an event handler or an effect. The provider and the engine follow; no engine is rebuilt for a track change:

```tsx
import { useArrangement } from '@waveform-playlist/browser';
import { audioTrack } from '@waveform-playlist/core';

// Inside the provider (or call the arrangement you made directly)
function AddFiles() {
  const arrangement = useArrangement();

  const handleFiles = (files: File[]) => {
    files
      .filter((file) => file.type.startsWith('audio/'))
      // A File is a source by identity; the track is named after the file
      .forEach((file) => arrangement.addTrack(audioTrack({ src: file })));
  };

  return (
    <input
      type="file"
      accept="audio/*"
      multiple
      onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
    />
  );
}
```

`arrangement.removeTrack(id)` removes a track as an undo step; `arrangement.removeTrack(id, { undoable: false })` removes it for good (no undo brings it back), which suits a dropped file that could not be decoded. `arrangement.setTracks([])` removes every track and clears the undo history.

Make these changes from a handler, an effect or a listener of `arrangement.sources`, **not from inside an `arrangement.subscribe()` listener or an engine `statechange` listener**. Two or more track edits made inside one listener run make the engine send its adapter every track at once (a full `setTracks`), which can interrupt playback. See [Using the Engine Directly](/docs/framework-agnostic/engine#reading).

## Loading State and Retry

`useArrangementSources(arrangement)` returns where each source is:

```typescript
interface ArrangementSourcesValue {
  sources: ReadonlyMap<ClipSource, { status: 'pending' | 'loaded' | 'failed'; error?: Error }>;
  pendingCount: number;
  failedCount: number;
  isLoading: boolean; // true while a source is pending
}
```

```tsx
import { useArrangement, useArrangementSources } from '@waveform-playlist/browser';

function LoadingStatus() {
  const arrangement = useArrangement();
  const { sources, pendingCount, isLoading } = useArrangementSources(arrangement);
  const failed = Array.from(sources).filter(([, state]) => state.status === 'failed');

  return (
    <div>
      {isLoading && <span>Loading {pendingCount} file(s)…</span>}
      {failed.map(([src, state], i) => (
        <span key={i}>
          Error loading audio: {state.error?.message}{' '}
          <button type="button" onClick={() => arrangement.retry(src)}>
            Retry
          </button>
        </span>
      ))}
    </div>
  );
}
```

The hook takes the arrangement as its argument, so it also works above the provider, with the arrangement you made. `arrangement.retry(src)` starts a source whose load failed again, and does nothing for any other source. A failed source also shows as `failed` when its audio loaded but a clip could not be made from it (for example an `offset` past the end of the file); its error says which clip, and `retry` changes nothing for it.

Keep the layout above the editor stable while audio loads, for example by drawing a loading indicator as an overlay that takes no space in the layout: a layout change that moves the editor while a clip is being moved leaves the dragged clip at the vertical position it had when the drag started, until the release (the move itself is committed correctly; issue #858).

Common errors are `Failed to fetch <url>` (a network error or a refused cross-origin request), `Failed to fetch <url>: 404 Not Found` and the browser's own decode error for a format it cannot decode (that one does not name the file). The URL in a message is cut before its query string, and a user name or password in it is left out.

## Placeholders While Audio Loads

A clip whose audio is still loading is not in `usePlaylistTimeline().tracks` and is not played. What the view draws for it depends on what the clip says about itself:

| The loading clip has | What is drawn |
|---|---|
| `waveformData` | A placeholder drawn from those peaks, at its place and length |
| a `duration` (no `waveformData`) | A placeholder box with no waveform in it, at its place and length, filled with the colour the waveform's bars are drawn in (`waveFillColor`, or `selectedWaveFillColor` on the selected track; `grey` when the theme gives no usable colour); it carries `data-clip-placeholder-body="true"` and is drawn with or without clip headers, on a spectrogram track too |
| only a `src` | Nothing, until its audio has loaded (the track's row and controls are there) |

A placeholder is dimmed (theme key `placeholderClipOpacity`, 0.5 by default), has no drag handle and no trim handles, and its container carries `data-clip-placeholder="true"`. The box of a placeholder without peaks is `<ClipPlaceholderBody />` from `@waveform-playlist/ui-components`, the clip's first child: the played-portion tint (`waveProgressColor`) and the fade curves of `<WaveformFades />` are drawn over it. Its record is in `usePlaylistTimeline().peaksDataArray` with `isPlaceholder: true`; there is no clip for it in `tracks`, so look a record up by `clipId`, not by its position in the row.

No placeholder is drawn until the provider has a sample rate: from mount at the provider's `sampleRate` prop when you pass it (a request: when the first adapter's context runs at another rate, placeholders are drawn again at that rate), otherwise once its first adapter exists. If the adapter can never be built (a missing optional peer, a `createAdapter` that throws) and no `sampleRate` prop is given, no placeholder is ever drawn. Pass `sampleRate` if placeholders must appear whatever happens to the engine. A placeholder's position and length are at the provider's sample rate, also when its peaks file was made at another rate.

`duration` in `usePlaylistTimeline()` counts loaded audio only. The view is drawn wide enough for a placeholder that ends later. A click on such a placeholder past the end of the loaded audio puts the cursor there; Play from there starts and stops at once, because the position is past the end of the loaded audio, and the cursor stays where it was. `seekTo` clamps to the loaded audio.

### Immediate Mode (Progressive Loading)

There is no mode to turn on: every playlist loads progressively. The provider draws at once, a clip with a `duration` or `waveformData` shows as a placeholder while its file decodes, and each clip becomes playable as its file arrives. (The removed `useAudioTracks` hook needed `{ immediate: true }` and the provider's `deferEngineRebuild` for this.)

For instant waveforms of large files, give each clip its pre-computed peaks: see [Using Pre-computed Waveforms](#using-pre-computed-waveforms).

## Pre-computed Waveform Data (BBC Peaks)

For large audio files, computing waveforms in the browser can be slow. [BBC audiowaveform](https://github.com/bbc/audiowaveform) is a C++ tool that generates waveform data files that can be loaded instantly.

### Why Use Pre-computed Waveforms?

| Approach | 10 min file | 1 hour file | 8 hour file |
|----------|-------------|-------------|-------------|
| Browser decode | ~5s | ~30s | ~4min |
| BBC Peaks | ~50ms | ~50ms | ~100ms |

### Generating Waveform Data

Install audiowaveform:

```bash
# macOS
brew install audiowaveform

# Ubuntu/Debian
sudo apt-get install audiowaveform

# From source
git clone https://github.com/bbc/audiowaveform.git
cd audiowaveform
mkdir build && cd build
cmake .. && make && sudo make install
```

Generate waveform data:

```bash
# Generate from Opus (recommended — always 48000 Hz)
audiowaveform -i audio.opus -o audio.dat -z 256 -b 8

# Generate from MP3 or WAV
audiowaveform -i audio.mp3 -o audio.dat -z 256 -b 8

# Generate 16-bit for higher precision
audiowaveform -i audio.opus -o audio.dat -z 256 -b 16
```

The `-z` option sets samples per pixel (zoom level). Lower values = more detail but larger files.

:::caution Sample Rate Matching
Pre-computed peaks embed the source audio's sample rate (e.g., 48000 Hz). The browser's `AudioContext` decodes audio at its **hardware** sample rate — typically 48000 Hz on most systems, but 44100 Hz on some devices.

**If the rates don't match**, the peaks will be slightly wider or narrower than the decoded audio, causing misaligned waveforms during trim, split, and zoom. When a mismatch is detected, waveform-playlist logs a warning and falls back to generating peaks from the decoded audio (slower initial load, but correct).

**Recommendations:**
- **Serve audio at 48000 Hz** to match most browser AudioContext hardware rates:
  - **Opus** — best compressed option. Always encodes at 48000 Hz (per spec), excellent quality at low bitrates, broad browser support. `ffmpeg -i audio.wav -c:a libopus audio.opus`
  - **WAV at 48000 Hz** — uncompressed, lossless. `ffmpeg -i audio.wav -ar 48000 audio-48k.wav`
  - **FLAC at 48000 Hz** — lossless compression (~50-60% of WAV). `ffmpeg -i audio.wav -ar 48000 audio-48k.flac`
- Generate `.dat` files from your 48000 Hz audio so peaks match the hardware rate
- **Set the `sampleRate` prop** to get an early warning when the hardware rate doesn't match:

```tsx
// React
<WaveformPlaylistProvider sampleRate={48000} arrangement={arrangement} />

// Web Components: the editor's rate is its adapter's AudioContext rate
import { NativePlayoutAdapter } from '@dawcore/transport';

editor.adapter = new NativePlayoutAdapter(new AudioContext({ sampleRate: 48000 }));
```

When the hardware rate matches, pre-computed peaks render instantly. On mismatch, peaks fall back to worker generation from decoded audio (slower but correct).
:::

### Using Pre-computed Waveforms

Load the peaks first, then add the tracks with the peaks attached, and render the provider once the tracks are in:

```tsx
import { useEffect, useState } from 'react';
import {
  WaveformPlaylistProvider,
  Waveform,
  useCreateArrangement,
  loadWaveformData,
} from '@waveform-playlist/browser';
import { audioTrack } from '@waveform-playlist/core';

function MyPlaylist() {
  // Starts empty: the track is added once its peaks have loaded (or failed)
  const arrangement = useCreateArrangement();
  const [peaksSettled, setPeaksSettled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // 1. Load BBC peaks first (fast - ~50KB). Without them the waveform comes from the audio.
    loadWaveformData('/audio/podcast.dat')
      .catch(() => undefined)
      .then((waveformData) => {
        if (cancelled) return;
        // An effect run again (StrictMode, Fast Refresh) must not add the track twice
        if (arrangement.getTracks().length === 0) {
          // 2. The clip names its audio and carries its peaks: drawn at once, playable once decoded
          arrangement.addTrack(audioTrack({ src: '/audio/podcast.mp3', name: 'Podcast Episode', waveformData }));
          // The first load is not an undo step
          arrangement.clearHistory();
        }
        setPeaksSettled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [arrangement]);

  if (!peaksSettled) return <div>Loading peaks…</div>;

  return (
    <WaveformPlaylistProvider arrangement={arrangement} sampleRate={48000}>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

The provider is rendered after the track is in because the playlist's [ready](#ready) happens once per mount: a provider mounted over an empty arrangement is ready at once, with no tracks.

When `waveformData` is provided:
1. The library uses BBC peaks instead of computing from audio
2. Zoom is supported via `resample()` at different samples-per-pixel
3. Clip trimming (offset/duration) is handled via `slice()`
4. All operations use sample-based precision (no floating-point errors)

### Waveform Data Format

BBC audiowaveform outputs JSON in this format:

```json
{
  "version": 2,
  "channels": 2,
  "sample_rate": 48000,
  "samples_per_pixel": 256,
  "bits": 8,
  "length": 1000,
  "data": [0, 10, -5, 15, ...]
}
```

The `sample_rate` field must match the browser's `AudioContext.sampleRate` for pre-computed peaks to be used. See the [sample rate matching](#generating-waveform-data) note above.

## Loading from Different Sources

### Remote URLs

```tsx
audioTrack({ src: 'https://example.com/audio.mp3', name: 'Remote Track' });
```

The server must allow the cross-origin request (CORS); otherwise the source fails with `Failed to fetch …`.

### Files (Uploads and Drops)

Pass the `File` itself as `src`; it is read with `file.arrayBuffer()`, so no blob URL is needed:

```tsx
arrangement.addTrack(audioTrack({ src: file })); // named after the file, without its extension
```

### AudioBuffer (Decoded Already)

Audio you have decoded yourself is an `audioBuffer`: the clip is loaded at once and nothing is fetched.

```tsx
async function addDecoded(arrangement: Arrangement, arrayBuffer: ArrayBuffer, audioContext: BaseAudioContext) {
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  arrangement.addTrack(audioTrack({ audioBuffer, name: 'Decoded' }));
}
```

(`Arrangement` is a type of `@waveform-playlist/engine`.)

### A Loader of Your Own

`useCreateArrangement(init, { loadSource })` replaces how a source becomes an `AudioBuffer` (by default: fetch a URL or read a Blob, then decode). `loadSource(src, { signal, audioContext })` returns a promise of the buffer; honour `signal`, which is aborted when the source is no longer wanted or the provider unmounts.

## Supported Formats

Waveform Playlist supports all formats supported by the Web Audio API:

| Format | Extension | Support |
|--------|-----------|---------|
| MP3 | .mp3 | All browsers |
| WAV | .wav | All browsers |
| OGG Vorbis | .ogg | Chrome, Firefox, Edge |
| AAC | .m4a, .aac | Safari, Chrome, Edge |
| FLAC | .flac | Chrome, Firefox, Edge |
| WebM | .webm | Chrome, Firefox |

## Ready

"Ready" is when the playlist can play. It happens **once per mount of the provider**: the first time an engine is attached and no source of the arrangement is still pending.

- A source that failed counts as settled: a playlist with a failed file is ready, and the error is in `useArrangementSources`.
- An empty arrangement is ready as soon as its engine is attached. A file added during the first load extends the wait; one added after the first ready does not bring the playlist back to "not ready".
- A source that never settles (a request that hangs: there is no load timeout yet, see issue #840) keeps the playlist from ever being ready, and Play does nothing all that time. Show the loading state while it lasts, so the page does not look stuck: `useArrangementSources(arrangement)` has `pendingCount` (sources still loading) and `isLoading` (`pendingCount > 0`).

```tsx
import { useArrangement, useArrangementSources } from '@waveform-playlist/browser';

function LoadingStatus() {
  const { pendingCount, isLoading } = useArrangementSources(useArrangement());
  return isLoading ? <p>Loading {pendingCount} file(s)…</p> : null;
}
```
- **Play does nothing before the first ready**, and nothing is queued: a Play press, Space or an annotation click during the first load does nothing (the annotation is not highlighted either), and in a development build one console warning per mount says so. Edits, the mixer, `seekTo` and the selection work before ready.
- `play()` called from `onReady`, or from an effect or layout effect that runs when `isReady` turns true, works.

After the first ready, `isReady` is false only while a later engine is being built (when `effects` changes identity or `zoomLevels` changes content), and true again as soon as that engine is attached, whatever is still loading. `onReady` and the event are not repeated then, nor after a StrictMode remount or an `<Activity>` hide and reveal.

A page that has to load something before its tracks exist (MIDI with `loadMidiTracks`, peaks files) adds the tracks, calls `arrangement.clearHistory()` once, and renders the provider after that, as in [Using Pre-computed Waveforms](#using-pre-computed-waveforms).

### Custom Event

The provider dispatches `waveform-playlist:ready` on the window at the first ready:

```tsx
useEffect(() => {
  const handleReady = (event: Event) => {
    const { trackCount, duration } = (event as CustomEvent<{ trackCount: number; duration: number }>).detail;
    console.log('Playlist ready:', trackCount, 'tracks,', duration, 'seconds of loaded audio');
  };

  window.addEventListener('waveform-playlist:ready', handleReady);
  return () => window.removeEventListener('waveform-playlist:ready', handleReady);
}, []);
```

`trackCount` counts every track of the arrangement, loaded or not; `duration` is the length of the loaded audio, in seconds.

### React Hook

Under `MediaElementPlaylistProvider` there is no `waveform-playlist:ready` event, and the hook is `useMediaElementTrack().isReady`. Under `WaveformPlaylistProvider`, read `isReady` from `usePlaylistTimeline()`:

```tsx
import { usePlaylistTimeline } from '@waveform-playlist/browser';

function LoadingIndicator() {
  const { isReady, tracks } = usePlaylistTimeline();

  if (!isReady) {
    return <div>Loading tracks...</div>;
  }

  return <div>{tracks.length} tracks</div>;
}
```

### Data Attribute (CSS/Testing)

The playlist container has a `data-playlist-state` attribute, `"loading"` or `"ready"`, that follows `isReady`. Under `MediaElementPlaylistProvider` it is `"ready"` from the first render, because the waveform is drawn from pre-computed peaks and does not wait for the player (`useMediaElementTrack().isReady` says whether the player has loaded):

```css
/* Dim the playlist while loading */
[data-playlist-state="loading"] {
  opacity: 0.5;
  pointer-events: none;
}

[data-playlist-state="ready"] {
  opacity: 1;
}
```

For E2E tests (Playwright, Cypress):

```typescript
// Playwright
await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });

// Cypress
cy.get('[data-playlist-state="ready"]', { timeout: 30000 });
```

### Provider Callback

```tsx
<WaveformPlaylistProvider
  arrangement={arrangement}
  onReady={() => console.log('Ready to play')}
>
  <Waveform />
</WaveformPlaylistProvider>
```

`onReady` is read when it is called, so an inline arrow builds nothing. If it throws, the provider logs the error and calls `onError` with it.

## Where Errors Land

Each kind of failure reaches a different place:

| What fails | Where it lands |
|---|---|
| A file that cannot be fetched or decoded | `useArrangementSources(arrangement)`: the source is `failed` with its `error`. Not `onError`. Start it again with `arrangement.retry(src)` |
| A track the arrangement refuses, in the `useCreateArrangement` initializer | A render error, thrown by the component that calls `useCreateArrangement`: the nearest error boundary **above that component** catches it |
| A track the arrangement refuses, from `arrangement.addTrack()`, `setTracks()` or `updateTrack()` | That call throws: the caller (your handler or effect) catches it. Nothing changed |
| The engine or its adapter cannot be built | The provider's `onError`, and a console error; the playlist stays in its loading state |
| `onReady` throws | A console error and `onError`; the playlist is ready all the same |

The arrangement refuses a track whose clips do not match its `kind` (a clip still loading on a MIDI track included), a duplicate track id, and two clips with one id on a track. It checks before changing anything.

```tsx
import { PlaylistErrorBoundary } from '@waveform-playlist/ui-components';

// The boundary wraps the component that calls useCreateArrangement
function MyPlaylist() {
  const arrangement = useCreateArrangement(() => initialTracks);
  return (
    <WaveformPlaylistProvider arrangement={arrangement}>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}

<PlaylistErrorBoundary fallback={<div>The playlist could not be created.</div>}>
  <MyPlaylist />
</PlaylistErrorBoundary>
```

```tsx
// A refused track throws at the call
const handleAdd = (track: ArrangementTrack) => {
  try {
    arrangement.addTrack(track);
  } catch (error) {
    showMessage(error instanceof Error ? error.message : String(error));
  }
};
```

## A Custom Adapter That Closes Its Context

The provider decodes with the `AudioContext` of its current adapter. A load still in flight when an engine is rebuilt carries on with the previous adapter's context. If your `createAdapter` returns an adapter whose `dispose()` closes its `AudioContext`, such a load can fail; it then shows as `failed`, and `arrangement.retry(src)` loads it again with the new context.

## Performance Tips

1. **Use pre-computed waveforms** for files over 5 minutes
2. **Generate peaks at 48000 Hz** to match most hardware — mismatched rates fall back to browser decoding
3. **Give clips a `duration`** (or peaks) so they are drawn before their audio has loaded
4. **Compress audio** - MP3 loads faster than WAV
5. **Consider streaming** for very long files

## Next Steps

- [Playback Controls](/docs/react/guides/playback-controls) - Control playback
- [Track Management](/docs/react/guides/track-management) - Manage loaded tracks
