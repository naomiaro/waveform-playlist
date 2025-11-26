---
sidebar_position: 1
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
interface AudioConfig {
  src: string;              // URL to audio file (required)
  name: string;             // Display name (required)
  startTime?: number;       // Start position in seconds (default: 0)
  waveformDataUrl?: string; // URL to pre-computed waveform data
  gain?: number;            // Initial volume 0-1 (default: 1)
  muted?: boolean;          // Start muted (default: false)
  soloed?: boolean;         // Start soloed (default: false)
  pan?: number;             // Pan position -1 to 1 (default: 0)
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
# Generate JSON format (recommended)
audiowaveform -i audio.mp3 -o audio.json --pixels-per-second 20

# Generate binary format (smaller file size)
audiowaveform -i audio.mp3 -o audio.dat --pixels-per-second 20
```

The `--pixels-per-second` option controls resolution. Higher values = more detail but larger files.

### Using Pre-computed Waveforms

```tsx
const { tracks, loading } = useAudioTracks([
  {
    src: '/audio/podcast.mp3',
    name: 'Podcast Episode',
    waveformDataUrl: '/audio/podcast.json', // Pre-computed waveform
  },
]);
```

When `waveformDataUrl` is provided:
1. The waveform data is loaded first (very fast)
2. The audio file is loaded in the background
3. Waveform displays immediately while audio loads

### Waveform Data Format

BBC audiowaveform outputs JSON in this format:

```json
{
  "version": 2,
  "channels": 2,
  "sample_rate": 44100,
  "samples_per_pixel": 256,
  "bits": 8,
  "length": 1000,
  "data": [0, 10, -5, 15, ...]
}
```

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

## Performance Tips

1. **Use pre-computed waveforms** for files over 5 minutes
2. **Load tracks lazily** - Only load what's visible
3. **Use appropriate sample rates** - 44.1kHz is usually sufficient
4. **Compress audio** - MP3 loads faster than WAV
5. **Consider streaming** for very long files

## Next Steps

- [Playback Controls](/docs/guides/playback-controls) - Control playback
- [Track Management](/docs/guides/track-management) - Manage loaded tracks
