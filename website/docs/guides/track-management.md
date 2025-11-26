---
sidebar_position: 3
---

# Track Management

Control individual tracks with mute, solo, volume, and pan controls.

## Track Controls Component

Enable the built-in track controls panel:

```tsx
<WaveformPlaylistProvider
  tracks={tracks}
  controls={{ show: true, width: 200 }}
>
  <Waveform />
</WaveformPlaylistProvider>
```

The controls panel displays:
- Track name
- Mute button
- Solo button
- Volume slider
- Pan slider

## useTrackControls Hook

For custom track control UI:

```tsx
import { useTrackControls } from '@waveform-playlist/browser';

function CustomTrackControls({ trackIndex }: { trackIndex: number }) {
  const {
    muted,
    soloed,
    volume,
    pan,
    setMuted,
    setSoloed,
    setVolume,
    setPan,
  } = useTrackControls(trackIndex);

  return (
    <div>
      <button onClick={() => setMuted(!muted)}>
        {muted ? 'Unmute' : 'Mute'}
      </button>
      <button onClick={() => setSoloed(!soloed)}>
        {soloed ? 'Unsolo' : 'Solo'}
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
      />
      <input
        type="range"
        min="-1"
        max="1"
        step="0.01"
        value={pan}
        onChange={(e) => setPan(parseFloat(e.target.value))}
      />
    </div>
  );
}
```

## Mute and Solo

### Mute

Muting a track silences it completely:

```tsx
const { muted, setMuted } = useTrackControls(trackIndex);

// Toggle mute
setMuted(!muted);

// Mute track
setMuted(true);

// Unmute track
setMuted(false);
```

### Solo

Soloing a track mutes all other non-soloed tracks:

```tsx
const { soloed, setSoloed } = useTrackControls(trackIndex);

// Toggle solo
setSoloed(!soloed);
```

When multiple tracks are soloed, only those tracks are audible.

## Volume Control

Volume ranges from 0 (silent) to 1 (full volume):

```tsx
const { volume, setVolume } = useTrackControls(trackIndex);

// Set to 50% volume
setVolume(0.5);

// Fade out
for (let v = volume; v >= 0; v -= 0.1) {
  setVolume(v);
  await delay(100);
}
```

## Pan Control

Pan ranges from -1 (full left) to 1 (full right):

```tsx
const { pan, setPan } = useTrackControls(trackIndex);

// Pan fully left
setPan(-1);

// Center
setPan(0);

// Pan fully right
setPan(1);
```

## Track Selection

Select tracks for operations like deletion or effects:

```tsx
import { usePlaylistState, usePlaylistControls } from '@waveform-playlist/browser';

function TrackSelector() {
  const { tracks, selectedTrackIndex } = usePlaylistState();
  const { selectTrack } = usePlaylistControls();

  return (
    <ul>
      {tracks.map((track, index) => (
        <li
          key={index}
          onClick={() => selectTrack(index)}
          style={{
            background: selectedTrackIndex === index ? '#e0e0ff' : 'transparent',
          }}
        >
          {track.name}
        </li>
      ))}
    </ul>
  );
}
```

## Adding and Removing Tracks

### Adding Tracks

```tsx
import { usePlaylistControls, useAudioTracks } from '@waveform-playlist/browser';

function AddTrackButton() {
  const { addTrack } = usePlaylistControls();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const blobUrl = URL.createObjectURL(file);
    const { tracks } = await useAudioTracks([
      { src: blobUrl, name: file.name.replace(/\.[^/.]+$/, '') },
    ]);

    if (tracks.length > 0) {
      addTrack(tracks[0]);
    }
  };

  return <input type="file" accept="audio/*" onChange={handleFileSelect} />;
}
```

### Removing Tracks

```tsx
import { usePlaylistControls, usePlaylistState } from '@waveform-playlist/browser';

function RemoveTrackButton() {
  const { selectedTrackIndex } = usePlaylistState();
  const { removeTrack } = usePlaylistControls();

  return (
    <button
      onClick={() => removeTrack(selectedTrackIndex)}
      disabled={selectedTrackIndex === null}
    >
      Remove Selected Track
    </button>
  );
}
```

## Track Reordering

Reorder tracks by drag and drop or programmatically:

```tsx
import { usePlaylistControls } from '@waveform-playlist/browser';

function TrackReorder() {
  const { moveTrack } = usePlaylistControls();

  // Move track from index 2 to index 0
  const moveToTop = () => moveTrack(2, 0);

  return <button onClick={moveToTop}>Move Track 3 to Top</button>;
}
```

## Initial Track Configuration

Set initial track states when loading:

```tsx
const { tracks, loading } = useAudioTracks([
  {
    src: '/audio/drums.mp3',
    name: 'Drums',
    gain: 0.8,        // 80% volume
    muted: false,
    soloed: false,
    pan: 0,           // Center
  },
  {
    src: '/audio/bass.mp3',
    name: 'Bass',
    gain: 1.0,        // Full volume
    muted: false,
    soloed: false,
    pan: -0.3,        // Slightly left
  },
  {
    src: '/audio/keys.mp3',
    name: 'Keys',
    gain: 0.7,
    muted: true,      // Start muted
    soloed: false,
    pan: 0.3,         // Slightly right
  },
]);
```

## Complete Example

```tsx
import {
  WaveformPlaylistProvider,
  Waveform,
  useAudioTracks,
  usePlaylistState,
  useTrackControls,
} from '@waveform-playlist/browser';

function TrackControlRow({ trackIndex }: { trackIndex: number }) {
  const { tracks } = usePlaylistState();
  const { muted, soloed, volume, pan, setMuted, setSoloed, setVolume, setPan } =
    useTrackControls(trackIndex);
  const track = tracks[trackIndex];

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '0.5rem' }}>
      <span style={{ width: '100px' }}>{track.name}</span>
      <button
        onClick={() => setMuted(!muted)}
        style={{ background: muted ? '#ff6b6b' : '#e0e0e0' }}
      >
        M
      </button>
      <button
        onClick={() => setSoloed(!soloed)}
        style={{ background: soloed ? '#ffd93d' : '#e0e0e0' }}
      >
        S
      </button>
      <label>
        Vol
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
        />
      </label>
      <label>
        Pan
        <input
          type="range"
          min="-1"
          max="1"
          step="0.01"
          value={pan}
          onChange={(e) => setPan(parseFloat(e.target.value))}
        />
      </label>
    </div>
  );
}

function TrackManagementExample() {
  const { tracks, loading } = useAudioTracks([
    { src: '/audio/drums.mp3', name: 'Drums' },
    { src: '/audio/bass.mp3', name: 'Bass' },
    { src: '/audio/vocals.mp3', name: 'Vocals' },
  ]);

  if (loading) return <div>Loading...</div>;

  return (
    <WaveformPlaylistProvider tracks={tracks} timescale>
      <div>
        {tracks.map((_, index) => (
          <TrackControlRow key={index} trackIndex={index} />
        ))}
      </div>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

## Next Steps

- [Annotations](/docs/guides/annotations) - Add time-synchronized annotations
- [Audio Effects](/docs/guides/effects) - Apply effects to tracks
