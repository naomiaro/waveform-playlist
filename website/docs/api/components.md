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
- Custom playhead rendering

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `timescale` | `boolean` | `false` | Show timeline with time markers |
| `showClipHeaders` | `boolean` | `false` | Show clip name headers above waveforms |
| `renderPlayhead` | `RenderPlayheadFunction` | - | Custom playhead render function |
| `renderTrackControls` | `(trackIndex: number) => ReactNode` | - | Custom track controls renderer |

### Usage

```tsx
<WaveformPlaylistProvider tracks={tracks}>
  <Waveform />
</WaveformPlaylistProvider>
```

The Waveform component reads configuration from the provider context.

---

## Custom Playhead

Replace the default playhead with a custom component using the `renderPlayhead` prop.

### PlayheadProps

The render function receives these props:

```typescript
interface PlayheadProps {
  /** Position in pixels from left edge */
  position: number;
  /** Playhead color from theme (default: #ff0000) */
  color?: string;
}
```

### Built-in Playhead Components

Import pre-built playhead variants:

```tsx
import { Playhead, PlayheadWithMarker } from '@waveform-playlist/ui-components';
```

#### Default Playhead

A simple vertical line (used by default):

```tsx
<Waveform />
// or explicitly:
<Waveform renderPlayhead={(props) => <Playhead {...props} />} />
```

#### PlayheadWithMarker

A playhead with a triangle marker at the top, positioned to sit in the timescale area:

```tsx
<Waveform
  timescale
  renderPlayhead={(props) => <PlayheadWithMarker {...props} />}
/>
```

### Custom Playhead Example

Create your own playhead component:

```tsx
import styled from 'styled-components';

const CustomPlayheadLine = styled.div<{ $position: number; $color: string }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  background: ${(props) => props.$color};
  transform: translate3d(${(props) => props.$position}px, 0, 0);
  z-index: 150;
  pointer-events: none;
  will-change: transform;
  border-radius: 2px;
  box-shadow: 0 0 4px ${(props) => props.$color};
`;

const GlowingPlayhead = ({ position, color = '#ff0000' }) => (
  <CustomPlayheadLine $position={position} $color={color} />
);

// Usage
<Waveform renderPlayhead={(props) => <GlowingPlayhead {...props} />} />
```

### Performance Tips

- Use `transform: translate3d()` for GPU-accelerated positioning
- Add `will-change: transform` for smooth animation
- Set `pointer-events: none` to prevent interference with track interactions

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

## Export Controls

### ExportWavButton

Export the playlist to a WAV file.

```tsx
<ExportWavButton />
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | `'Export WAV'` | Button label |
| `filename` | `string` | `'export'` | Downloaded file name (without extension) |
| `mode` | `'master' \| 'individual'` | `'master'` | Export all tracks mixed or single track |
| `trackIndex` | `number` | - | Track index for individual export |
| `bitDepth` | `16 \| 32` | `16` | WAV bit depth (16-bit PCM or 32-bit float) |
| `applyEffects` | `boolean` | `true` | Apply fades and other clip effects |
| `effectsFunction` | `EffectsFunction` | - | Tone.js effects chain for export with effects |
| `className` | `string` | - | CSS class name |
| `onExportComplete` | `(blob: Blob) => void` | - | Callback when export succeeds |
| `onExportError` | `(error: Error) => void` | - | Callback when export fails |

**Behavior:**
- Shows progress percentage during export
- Disabled when no tracks loaded
- Automatically triggers download when complete

**Example:**

```tsx
<ExportWavButton
  filename="my-mix"
  mode="master"
  bitDepth={16}
  onExportComplete={(blob) => console.log('Exported:', blob.size, 'bytes')}
/>
```

**Individual Track Export:**

```tsx
<ExportWavButton
  label="Export Track 1"
  filename="track-1"
  mode="individual"
  trackIndex={0}
/>
```

**Export Without Effects (Raw Audio):**

```tsx
<ExportWavButton
  label="Export Raw"
  filename="raw-export"
  applyEffects={false}
/>
```

**Export With Tone.js Effects:**

```tsx
import { Reverb } from 'tone';

// Define effects chain
const createEffectsChain = (masterVolume, destination, isOffline) => {
  const reverb = new Reverb({ decay: 2.5, wet: 0.3 });
  masterVolume.connect(reverb);
  reverb.connect(destination);

  // Return cleanup function
  return () => {
    reverb.dispose();
  };
};

// Use in export button
<ExportWavButton
  label="Export with Reverb"
  filename="mix-with-effects"
  effectsFunction={createEffectsChain}
/>
```

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
  ExportWavButton,
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

      {/* Export */}
      <div style={{ marginBottom: '1rem' }}>
        <ExportWavButton filename="my-mix" />
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

- [WaveformPlaylistProvider](/docs/api/provider)
- [Hooks](/docs/api/hooks)
- [Theming Guide](/docs/guides/theming)
