---
sidebar_position: 1
description: "Load audio files, AudioBuffers, and pre-computed waveform data into Waveform Playlist tracks"
---

# Loading Audio

Waveform Playlist supports multiple methods for loading audio, from simple URL loading to pre-computed waveform data for large files.

## Basic Loading with useAudioTracks

The `useAudioTracks` hook is the recommended way to load audio files:

```tsx
import { useAudioTracks } from '@waveform-playlist/browser';

function MyPlaylist() {
  const { tracks, loading, error, progress } = useAudioTracks([
    { src: '/audio/track1.mp3', name: 'Track 1' },
    { src: '/audio/track2.wav', name: 'Track 2' },
  ]);

  if (loading) {
    return <div>Loading... {Math.round(progress * 100)}%</div>;
  }

  if (error) {
    return <div>Error loading audio: {error}</div>;
  }

  return (
    <WaveformPlaylistProvider tracks={tracks}>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

## AudioConfig Options

Each track configuration supports these options:

```tsx
interface AudioTrackConfig {
  src?: string;              // URL to audio file
  audioBuffer?: AudioBuffer; // Pre-loaded AudioBuffer (skips fetch/decode)
  name?: string;             // Display name
  startTime?: number;        // Start position in seconds (default: 0)
  duration?: number;         // Clip duration in seconds (default: full audio)
  offset?: number;           // Offset into source audio in seconds (default: 0)
  waveformData?: WaveformDataObject; // Pre-computed waveform data from BBC audiowaveform
  volume?: number;           // Initial volume 0-1 (default: 1)
  muted?: boolean;           // Start muted (default: false)
  soloed?: boolean;          // Start soloed (default: false)
  pan?: number;              // Pan position -1 to 1 (default: 0)
  color?: string;            // Waveform color
  fadeIn?: Fade;             // Fade in configuration
  fadeOut?: Fade;            // Fade out configuration
}
```

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
<WaveformPlaylistProvider sampleRate={48000} tracks={tracks} />

// Web Components
<daw-editor sample-rate="48000">
```

When the hardware rate matches, pre-computed peaks render instantly. On mismatch, peaks fall back to worker generation from decoded audio (slower but correct).
:::

### Using Pre-computed Waveforms

Load the waveform data first, then pass it to `useAudioTracks`:

```tsx
import { useAudioTracks, loadWaveformData } from '@waveform-playlist/browser';

function MyPlaylist() {
  const [waveformData, setWaveformData] = useState(null);

  // 1. Load BBC peaks first (fast - ~50KB)
  useEffect(() => {
    loadWaveformData('/audio/podcast.dat').then(setWaveformData);
  }, []);

  // 2. Load audio with waveformData attached (slower - full audio file)
  const { tracks, loading } = useAudioTracks(
    waveformData ? [{
      src: '/audio/podcast.mp3',
      name: 'Podcast Episode',
      waveformData, // Attach pre-computed peaks!
    }] : []
  );

  // Waveform uses BBC peaks instead of computing from audio buffer
  // Supports zoom via resample() and trim via slice()
  return (
    <WaveformPlaylistProvider tracks={tracks}>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

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
const config = [
  { src: 'https://example.com/audio.mp3', name: 'Remote Track' },
];
```

### Blob URLs (File Uploads)

```tsx
function FileUploader() {
  const [audioConfigs, setAudioConfigs] = useState([]);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    const blobUrl = URL.createObjectURL(file);

    setAudioConfigs([
      { src: blobUrl, name: file.name.replace(/\.[^/.]+$/, '') },
    ]);
  };

  const { tracks, loading } = useAudioTracks(audioConfigs);

  return (
    <>
      <input type="file" accept="audio/*" onChange={handleFileSelect} />
      {!loading && tracks.length > 0 && (
        <WaveformPlaylistProvider tracks={tracks}>
          <Waveform />
        </WaveformPlaylistProvider>
      )}
    </>
  );
}
```

### ArrayBuffer (Manual Loading)

For advanced use cases, you can decode audio manually:

```tsx
import * as Tone from 'tone';
import { createTrack, createClipFromSeconds } from '@waveform-playlist/core';

async function loadFromArrayBuffer(arrayBuffer: ArrayBuffer, name: string) {
  const audioContext = Tone.getContext().rawContext as AudioContext;
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const clip = createClipFromSeconds({
    audioBuffer,
    startTime: 0,
    duration: audioBuffer.duration,
    offset: 0,
    name,
  });

  return createTrack({
    name,
    clips: [clip],
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  });
}
```

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

## Error Handling

```tsx
const { tracks, loading, error } = useAudioTracks(configs);

if (error) {
  // error is a string with the error message
  console.error('Failed to load audio:', error);

  // Common errors:
  // - "Failed to fetch" - Network error or CORS
  // - "Unable to decode audio data" - Unsupported format
  // - "404 Not Found" - File doesn't exist
}
```

## Detecting Load Completion

The playlist dispatches a custom event and exposes state when all tracks finish loading. This is useful for showing loading indicators, enabling controls, or running E2E tests.

### Custom Event (Recommended)

Listen for the `waveform-playlist:ready` event on the window:

```tsx
useEffect(() => {
  const handleReady = (event: CustomEvent) => {
    console.log('Playlist ready!');
    console.log('Tracks loaded:', event.detail.trackCount);
    console.log('Duration:', event.detail.duration, 'seconds');
  };

  window.addEventListener('waveform-playlist:ready', handleReady);
  return () => window.removeEventListener('waveform-playlist:ready', handleReady);
}, []);
```

### React Hook

Access the `isReady` state from the `usePlaylistData()` hook:

```tsx
import { usePlaylistData } from '@waveform-playlist/browser';

function LoadingIndicator() {
  const { isReady, tracks } = usePlaylistData();

  if (!isReady) {
    return <div>Loading tracks...</div>;
  }

  return <div>{tracks.length} tracks loaded</div>;
}
```

### Data Attribute (CSS/Testing)

The playlist container has a `data-playlist-state` attribute:

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

The `WaveformPlaylistProvider` also accepts an `onReady` callback:

```tsx
<WaveformPlaylistProvider
  tracks={tracks}
  onReady={() => console.log('All tracks loaded!')}
>
  <Waveform />
</WaveformPlaylistProvider>
```

## Immediate Mode (Progressive Loading)

By default, `useAudioTracks` waits for all files to decode before returning tracks. With `immediate` mode, placeholder tracks render instantly based on config dimensions, and peaks fill in as each file decodes:

```tsx
const { tracks, loading } = useAudioTracks(
  [
    { src: '/audio/vocals.mp3', name: 'Vocals', duration: 30 },
    { src: '/audio/drums.mp3', name: 'Drums', duration: 30 },
  ],
  { immediate: true }
);

return (
  <WaveformPlaylistProvider tracks={tracks} deferEngineRebuild={loading}>
    <Waveform />
  </WaveformPlaylistProvider>
);
```

**Key points:**

- Each config needs `duration` (or `waveformData` with duration) so clip dimensions are known upfront
- `deferEngineRebuild={loading}` prevents the engine from rebuilding on every track update — it builds once when all tracks are ready
- Tracks appear immediately as empty clips, then waveform peaks fill in as audio decodes
- Progress is available via `loadedCount` and `totalCount` from the hook

```tsx
const { tracks, loading, loadedCount, totalCount } = useAudioTracks(configs, { immediate: true });
// loadedCount: 3, totalCount: 7 → "Loading 3/7..."
```

## Performance Tips

1. **Use pre-computed waveforms** for files over 5 minutes
2. **Generate peaks at 48000 Hz** to match most hardware — mismatched rates fall back to browser decoding
3. **Load tracks lazily** - Only load what's visible
4. **Compress audio** - MP3 loads faster than WAV
5. **Consider streaming** for very long files

## Next Steps

- [Playback Controls](/docs/guides/playback-controls) - Control playback
- [Track Management](/docs/guides/track-management) - Manage loaded tracks
