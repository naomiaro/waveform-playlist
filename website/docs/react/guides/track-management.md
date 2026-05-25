---
sidebar_position: 3
description: "Manage audio tracks with mute, solo, volume, pan, and dynamic add/remove"
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

## Programmatic Track Controls

Use `usePlaylistControls()` and `usePlaylistData()` for custom track control UI:

```tsx
import { usePlaylistControls, usePlaylistData } from '@waveform-playlist/browser';

function CustomTrackControls({ trackIndex }: { trackIndex: number }) {
  const { setTrackMute, setTrackSolo, setTrackVolume, setTrackPan } = usePlaylistControls();
  const { trackStates } = usePlaylistData();
  const state = trackStates[trackIndex];

  if (!state) return null;

  return (
    <div>
      <button onClick={() => setTrackMute(trackIndex, !state.muted)}>
        {state.muted ? 'Unmute' : 'Mute'}
      </button>
      <button onClick={() => setTrackSolo(trackIndex, !state.soloed)}>
        {state.soloed ? 'Unsolo' : 'Solo'}
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={state.volume}
        onChange={(e) => setTrackVolume(trackIndex, parseFloat(e.target.value))}
      />
      <input
        type="range"
        min="-1"
        max="1"
        step="0.01"
        value={state.pan}
        onChange={(e) => setTrackPan(trackIndex, parseFloat(e.target.value))}
      />
    </div>
  );
}
```

## Mute and Solo

### Mute

Muting a track silences it completely:

```tsx
const { setTrackMute } = usePlaylistControls();
const { trackStates } = usePlaylistData();

// Toggle mute
setTrackMute(trackIndex, !trackStates[trackIndex].muted);

// Mute track
setTrackMute(trackIndex, true);

// Unmute track
setTrackMute(trackIndex, false);
```

### Solo

Soloing a track mutes all other non-soloed tracks:

```tsx
const { setTrackSolo } = usePlaylistControls();
const { trackStates } = usePlaylistData();

// Toggle solo
setTrackSolo(trackIndex, !trackStates[trackIndex].soloed);
```

When multiple tracks are soloed, only those tracks are audible.

## Volume Control

Volume ranges from 0 (silent) to 1 (full volume):

```tsx
const { setTrackVolume } = usePlaylistControls();

// Set to 50% volume
setTrackVolume(trackIndex, 0.5);
```

## Pan Control

Pan ranges from -1 (full left) to 1 (full right):

```tsx
const { setTrackPan } = usePlaylistControls();

// Pan fully left
setTrackPan(trackIndex, -1);

// Center
setTrackPan(trackIndex, 0);

// Pan fully right
setTrackPan(trackIndex, 1);
```

## Track Selection

Select tracks for operations like deletion or effects:

```tsx
import { usePlaylistState, usePlaylistControls, usePlaylistData } from '@waveform-playlist/browser';

function TrackSelector() {
  const { tracks } = usePlaylistData();
  const { selectedTrackId } = usePlaylistState();
  const { setSelectedTrackId } = usePlaylistControls();

  return (
    <ul>
      {tracks.map((track) => (
        <li
          key={track.id}
          onClick={() => setSelectedTrackId(track.id)}
          style={{
            background: selectedTrackId === track.id ? '#e0e0ff' : 'transparent',
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

Track management (adding, removing, reordering) is handled by updating the `tracks` prop passed to `WaveformPlaylistProvider`. The provider does not have built-in `addTrack` / `removeTrack` / `moveTrack` methods — you manage tracks in your own state:

```tsx
import { WaveformPlaylistProvider, Waveform, useAudioTracks } from '@waveform-playlist/browser';

function TrackManagementExample() {
  const { tracks: initialTracks, loading } = useAudioTracks([
    { src: '/audio/drums.mp3', name: 'Drums' },
    { src: '/audio/bass.mp3', name: 'Bass' },
  ]);
  const [tracks, setTracks] = useState(initialTracks);

  // Update tracks when initial load completes
  useEffect(() => {
    if (!loading) setTracks(initialTracks);
  }, [initialTracks, loading]);

  const removeTrack = (index: number) => {
    setTracks((prev) => prev.filter((_, i) => i !== index));
  };

  const moveTrack = (fromIndex: number, toIndex: number) => {
    setTracks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  if (loading) return <div>Loading...</div>;

  return (
    <WaveformPlaylistProvider tracks={tracks}>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

## Initial Track Configuration

Set initial track states when loading:

```tsx
const { tracks, loading } = useAudioTracks([
  {
    src: '/audio/drums.mp3',
    name: 'Drums',
    volume: 0.8,       // 80% volume
    muted: false,
    soloed: false,
    pan: 0,            // Center
  },
  {
    src: '/audio/bass.mp3',
    name: 'Bass',
    volume: 1.0,       // Full volume
    muted: false,
    soloed: false,
    pan: -0.3,         // Slightly left
  },
  {
    src: '/audio/keys.mp3',
    name: 'Keys',
    volume: 0.7,
    muted: true,       // Start muted
    soloed: false,
    pan: 0.3,          // Slightly right
  },
]);
```

## Complete Example

```tsx
import {
  WaveformPlaylistProvider,
  Waveform,
  useAudioTracks,
  usePlaylistControls,
  usePlaylistData,
} from '@waveform-playlist/browser';

function TrackControlRow({ trackIndex }: { trackIndex: number }) {
  const { trackStates } = usePlaylistData();
  const { setTrackMute, setTrackSolo, setTrackVolume, setTrackPan } = usePlaylistControls();
  const state = trackStates[trackIndex];

  if (!state) return null;

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '0.5rem' }}>
      <span style={{ width: '100px' }}>{state.name}</span>
      <button
        onClick={() => setTrackMute(trackIndex, !state.muted)}
        style={{ background: state.muted ? '#ff6b6b' : '#e0e0e0' }}
      >
        M
      </button>
      <button
        onClick={() => setTrackSolo(trackIndex, !state.soloed)}
        style={{ background: state.soloed ? '#ffd93d' : '#e0e0e0' }}
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
          value={state.volume}
          onChange={(e) => setTrackVolume(trackIndex, parseFloat(e.target.value))}
        />
      </label>
      <label>
        Pan
        <input
          type="range"
          min="-1"
          max="1"
          step="0.01"
          value={state.pan}
          onChange={(e) => setTrackPan(trackIndex, parseFloat(e.target.value))}
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

- [Annotations](/docs/react/guides/annotations) - Add time-synchronized annotations
- [Audio Effects](/docs/react/guides/effects) - Apply effects to tracks
