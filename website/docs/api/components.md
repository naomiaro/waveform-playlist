---
sidebar_position: 2
---

# Components

Pre-built React components for building audio applications.

## Import

```tsx
import {
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  // ... other components
} from '@waveform-playlist/browser';
```

## Waveform

The main visualization component that renders tracks and handles interactions.

```tsx
<Waveform />
```

### Features

- Canvas-based waveform rendering
- Click to seek
- Drag to select
- Drag clips to move/trim
- Keyboard shortcuts

### Usage

```tsx
<WaveformPlaylistProvider tracks={tracks}>
  <Waveform />
</WaveformPlaylistProvider>
```

The Waveform component reads configuration from the provider context.

---

## Playback Buttons

### PlayButton

Starts playback from the current cursor position.

```tsx
<PlayButton />
```

**Behavior:**
- Disabled during playback
- Starts from selection start if selection exists

### PauseButton

Pauses playback, maintaining cursor position.

```tsx
<PauseButton />
```

**Behavior:**
- Disabled when not playing

### StopButton

Stops playback and resets cursor to start.

```tsx
<StopButton />
```

**Behavior:**
- Always enabled

### RewindButton

Jumps backward by a fixed amount.

```tsx
<RewindButton />
```

**Default:** 5 seconds

### FastForwardButton

Jumps forward by a fixed amount.

```tsx
<FastForwardButton />
```

**Default:** 5 seconds

---

## Zoom Controls

### ZoomInButton

Decreases samplesPerPixel for more detail.

```tsx
<ZoomInButton />
```

**Behavior:**
- Disabled at minimum zoom (128 spp)

### ZoomOutButton

Increases samplesPerPixel for wider view.

```tsx
<ZoomOutButton />
```

**Behavior:**
- Disabled at maximum zoom (8192 spp)

---

## Volume Controls

### MasterVolumeControl

Slider for overall output volume.

```tsx
<MasterVolumeControl />
```

**Range:** 0 (silent) to 1 (full)

### TrackVolumeControl

Volume slider for a specific track.

```tsx
<TrackVolumeControl trackIndex={0} />
```

**Props:**
- `trackIndex` (required): Index of the track

---

## Position Display

### AudioPosition

Shows current time and duration.

```tsx
<AudioPosition />
// Output: "0:00.000 / 3:45.123"
```

The format respects the current time format setting.

---

## Time Format

### TimeFormatSelect

Dropdown for selecting time display format.

```tsx
<TimeFormatSelect />
```

**Options:**
- `seconds` - 0.000
- `thousandths` - 0:00.000
- `hh:mm:ss` - 0:00:00
- `hh:mm:ss.u` - 0:00:00.0
- `hh:mm:ss.uu` - 0:00:00.00
- `hh:mm:ss.uuu` - 0:00:00.000

---

## Checkboxes

### ContinuousPlayCheckbox

Toggle for loop mode.

```tsx
<ContinuousPlayCheckbox />
```

### AutomaticScrollCheckbox

Toggle for auto-scrolling during playback.

```tsx
<AutomaticScrollCheckbox />
```

---

## Track Controls

### TrackControls

Built-in control panel for a track.

```tsx
<TrackControls trackIndex={0} />
```

**Includes:**
- Track name
- Mute button
- Solo button
- Volume slider
- Pan slider

### TrackControlsWithDelete

TrackControls with a delete button.

```tsx
<TrackControlsWithDelete
  trackIndex={0}
  onDelete={() => removeTrack(0)}
/>
```

**Props:**
- `trackIndex` (required): Track index
- `onDelete` (required): Delete callback

---

## Complete Example

```tsx
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  RewindButton,
  FastForwardButton,
  ZoomInButton,
  ZoomOutButton,
  MasterVolumeControl,
  AudioPosition,
  TimeFormatSelect,
  ContinuousPlayCheckbox,
  AutomaticScrollCheckbox,
  useAudioTracks,
} from '@waveform-playlist/browser';

function FullFeaturedPlaylist() {
  const { tracks, loading, error } = useAudioTracks([
    { src: '/audio/track1.mp3', name: 'Track 1' },
    { src: '/audio/track2.mp3', name: 'Track 2' },
  ]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      samplesPerPixel={1024}
      waveHeight={100}
      timescale
      controls={{ show: true, width: 180 }}
    >
      {/* Transport Controls */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <RewindButton />
        <PlayButton />
        <PauseButton />
        <StopButton />
        <FastForwardButton />
      </div>

      {/* Zoom Controls */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <ZoomInButton />
        <ZoomOutButton />
      </div>

      {/* Volume and Position */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
        <MasterVolumeControl />
        <AudioPosition />
        <TimeFormatSelect />
      </div>

      {/* Options */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <ContinuousPlayCheckbox />
        <AutomaticScrollCheckbox />
      </div>

      {/* Waveform */}
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

---

## Styling Components

All components accept standard React props including `className` and `style`:

```tsx
<PlayButton className="my-play-button" />
<PlayButton style={{ backgroundColor: 'green' }} />
```

For consistent styling, use the theme system or wrap components:

```tsx
const StyledPlayButton = styled(PlayButton)`
  background: #0066cc;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background: #0055aa;
  }

  &:disabled {
    background: #cccccc;
    cursor: not-allowed;
  }
`;
```

## See Also

- [WaveformPlaylistProvider](/api/provider)
- [Hooks](/api/hooks)
- [Theming Guide](/guides/theming)
