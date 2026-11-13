---
sidebar_position: 2
description: "Add play, pause, stop, seek, volume, and zoom controls to your Waveform Playlist"
---

# Playback Controls

Waveform Playlist provides both pre-built UI components and hooks for controlling audio playback.

## Button Components

Import and use the built-in button components:

```tsx
import {
  PlayButton,
  PauseButton,
  StopButton,
  RewindButton,
  FastForwardButton,
} from '@waveform-playlist/browser';

function Controls() {
  return (
    <div>
      <RewindButton />
      <PlayButton />
      <PauseButton />
      <StopButton />
      <FastForwardButton />
    </div>
  );
}
```

These buttons automatically connect to the playlist context and update their state accordingly. Play is disabled while playing; Pause and Stop are disabled unless playing. Rewind, Fast Forward and the two skip buttons call `seekTo`, which clamps to the audio and, during playback, restarts playback at the new position.

### Which controls work under which provider

The controls read the nearest playlist provider.

| Works under | Components |
| --- | --- |
| Either provider | `PlayButton`, `PauseButton`, `StopButton`, `RewindButton`, `FastForwardButton`, `SkipBackwardButton`, `SkipForwardButton`, `ClearAllButton`, `AudioPosition`, `TimeFormatSelect`, `SelectionTimeInputs`, `AutomaticScrollCheckbox`, and, inside `<AnnotationProvider>`, `ContinuousPlayCheckbox` and `DownloadAnnotationsButton` |
| `MediaElementPlaylistProvider` only | `PlaybackRateSelect` |
| `WaveformPlaylistProvider` only | `LoopButton`, `SetLoopRegionButton`, `ZoomInButton`, `ZoomOutButton`, `MasterVolumeControl`, `LinkEndpointsCheckbox`, `EditableCheckbox`, `KeyboardShortcuts`, `ExportWavButton` (from `@waveform-playlist/browser/tone`) |

A control used under a provider that does not serve it throws, for example "useLoop needs WaveformPlaylistProvider, and the nearest playlist provider here is MediaElementPlaylistProvider, which does not provide it".

## Custom Playback Controls

For custom UI, use `usePlaybackControls()` and `useIsPlaying()`. Both work under either provider:

```tsx
import { usePlaybackControls, useIsPlaying } from '@waveform-playlist/browser';

function CustomControls() {
  const { play, pause, stop } = usePlaybackControls();
  const { isPlaying } = useIsPlaying();

  return (
    <div>
      <button onClick={() => play()} disabled={isPlaying}>
        Play
      </button>
      <button onClick={pause} disabled={!isPlaying}>
        Pause
      </button>
      <button onClick={stop}>
        Stop
      </button>
      <span>Status: {isPlaying ? 'Playing' : 'Stopped'}</span>
    </div>
  );
}
```

## Seeking

### Click-to-Seek

By default, clicking on the waveform seeks to that position, and dragging selects a range.

During playback nothing happens until the mouse button is released:

- A click moves playback to the clicked position.
- A drag is highlighted as it is drawn while playback carries on; on release the range becomes the selection and is played from its start to its end (with looping on under `WaveformPlaylistProvider`: open-ended from its start).
- With automatic scroll on, no range can be drawn during playback (the waveform moves under the pointer): a press and its release are one seek, to where the press landed. Switch automatic scroll off to select a range while playing.

### Programmatic Seeking

```tsx
import { usePlaybackControls } from '@waveform-playlist/browser';

function SeekControls() {
  const { seekTo } = usePlaybackControls();

  return (
    <div>
      <button onClick={() => seekTo(0)}>Go to Start</button>
      <button onClick={() => seekTo(30)}>Go to 0:30</button>
      <button onClick={() => seekTo(60)}>Go to 1:00</button>
    </div>
  );
}
```

## Current Position

### AudioPosition Component

Display the current playback position:

```tsx
import { AudioPosition } from '@waveform-playlist/browser';

function PositionDisplay() {
  return <AudioPosition />;
}
// Displays the position only, in the provider's time format
// (default hh:mm:ss.uuu), for example "00:00:08.000"
```

### Programmatic Access

Access the resting cursor position from `useCurrentTime()` and duration from `usePlaylistTimeline()` (under `MediaElementPlaylistProvider`, from `useMediaElementTrack()`). `currentTime` changes on a seek, a pause and a stop; it does not advance during playback. For a display that runs during playback, use `<AudioPosition />` or register a frame callback with `usePlaybackRefs()`.

```tsx
import { useCurrentTime, usePlaylistTimeline } from '@waveform-playlist/browser';

function CustomPosition() {
  const { currentTime } = useCurrentTime();
  const { duration } = usePlaylistTimeline();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <span>
      {formatTime(currentTime)} / {formatTime(duration)}
    </span>
  );
}
```

## Time Format Selection

Allow users to choose their preferred time format:

```tsx
import { TimeFormatSelect } from '@waveform-playlist/browser';

function FormatSelector() {
  return <TimeFormatSelect />;
}
```

Available formats:
- `seconds` - 0.000
- `thousandths` - 0:00.000
- `hh:mm:ss` - 0:00:00
- `hh:mm:ss.u` - 0:00:00.0
- `hh:mm:ss.uu` - 0:00:00.00
- `hh:mm:ss.uuu` - 0:00:00.000

## Continuous Play

Enable continuous playback (loop) mode:

```tsx
import { ContinuousPlayCheckbox } from '@waveform-playlist/browser';

function LoopControl() {
  return <ContinuousPlayCheckbox />;
}
```

Or control it programmatically:

```tsx
import { useAnnotations, usePlaybackControls } from '@waveform-playlist/browser';

function ContinuousPlayToggle() {
  const { continuousPlay } = useAnnotations();
  const { setContinuousPlay } = usePlaybackControls();

  return (
    <label>
      <input
        type="checkbox"
        checked={continuousPlay}
        onChange={(e) => setContinuousPlay(e.target.checked)}
      />
      Loop
    </label>
  );
}
```

## Automatic Scroll

Keep the playhead visible during playback. While it is on, a drag on the waveform during playback does not select a range (see [Click-to-Seek](#click-to-seek)):

```tsx
import { AutomaticScrollCheckbox } from '@waveform-playlist/browser';

function ScrollControl() {
  return <AutomaticScrollCheckbox />;
}
```

## Playback Speed

`MediaElementPlaylistProvider` only. `PlaybackRateSelect` is a dropdown of speeds that reads and sets the provider's playback rate:

```tsx
import { PlaybackRateSelect } from '@waveform-playlist/browser';

function SpeedControl() {
  return <PlaybackRateSelect />;
}

// Or choose the speeds to offer:
<PlaybackRateSelect rates={[0.75, 1, 1.5]} />;
```

Without `rates` it offers 0.5, 0.75, 1, 1.25, 1.5 and 2. For a custom control, read `usePlaybackRate()`:

```tsx
import { usePlaybackRate } from '@waveform-playlist/browser';

function SpeedButtons() {
  const { playbackRate, setPlaybackRate } = usePlaybackRate();
  // setPlaybackRate clamps to 0.5–2
  return <button onClick={() => setPlaybackRate(1.5)}>{playbackRate}×</button>;
}
```

## Loop Playback

`WaveformPlaylistProvider` only; there is no loop under `MediaElementPlaylistProvider`.

Waveform Playlist uses an Audacity-style loop system with a separate loop region from the selection. This allows you to:

- Define a loop region independently from your playback selection
- Start playback before the loop region - it will loop when the cursor enters and reaches the end of the region
- Toggle looping on/off without losing the loop region
- Create and adjust loop regions visually in the timescale area

The loop region is displayed only in the timescale (ruler) area, keeping the tracks area clean for waveform visualization and selection.

### Two-Button Workflow

1. **SetLoopRegionButton** - Creates a loop region from the current selection (or clears it)
2. **LoopButton** - Enables/disables the looping behavior

```tsx
import { SetLoopRegionButton, LoopButton } from '@waveform-playlist/browser';

function LoopControls() {
  return (
    <div>
      <SetLoopRegionButton />
      <LoopButton />
    </div>
  );
}
```

### SetLoopRegionButton

Creates a loop region from the current selection.

```tsx
<SetLoopRegionButton />
```

**Behavior:**
- Disabled when no selection exists and no loop region is set
- Shows "Set Loop" when no loop region exists
- Shows "Clear Loop" when a loop region is set
- Click to set loop region from selection, or clear existing loop region

### LoopButton

Toggles the looping behavior.

```tsx
<LoopButton />
```

**Behavior:**
- Shows "Loop Off" when disabled, "Loop On" when enabled
- If no loop region exists when enabling, creates a default loop region (first 10s or 25% of duration)
- When enabled, playback loops when the cursor enters and reaches the end of the loop region

### Programmatic Control

```tsx
import { useLoop, useSelection, useEditorControls } from '@waveform-playlist/browser';

function CustomLoopControls() {
  const { isLoopEnabled, loopStart, loopEnd } = useLoop();
  const { selectionStart, selectionEnd } = useSelection();
  const { setLoopEnabled, setLoopRegionFromSelection, clearLoopRegion } = useEditorControls();

  const hasSelection = selectionStart !== selectionEnd && selectionEnd > selectionStart;
  const hasLoopRegion = loopStart !== loopEnd && loopEnd > loopStart;

  return (
    <div>
      <button
        onClick={hasLoopRegion ? clearLoopRegion : setLoopRegionFromSelection}
        disabled={!hasSelection && !hasLoopRegion}
      >
        {hasLoopRegion ? 'Clear Loop' : 'Set Loop'}
      </button>
      <button
        onClick={() => setLoopEnabled(!isLoopEnabled)}
        disabled={!hasLoopRegion}
      >
        {isLoopEnabled ? 'Loop On' : 'Loop Off'}
      </button>
    </div>
  );
}
```

### Complete Loop Example

```tsx
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  SetLoopRegionButton,
  LoopButton,
  SelectionTimeInputs,
  useAudioTracks,
} from '@waveform-playlist/browser';

function LoopExample() {
  const { tracks, loading } = useAudioTracks([
    { src: '/audio/track.mp3', name: 'Track' },
  ]);

  if (loading) return <div>Loading...</div>;

  return (
    <WaveformPlaylistProvider tracks={tracks}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <PlayButton />
        <PauseButton />
        <StopButton />
        <SetLoopRegionButton />
        <LoopButton />
      </div>
      <SelectionTimeInputs />
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

**Workflow:**
1. Click and drag on the waveform to create a selection
2. Click "Set Loop" to create a loop region from the selection (or drag in the timescale)
3. Click "Loop On" to enable looping
4. Press Play - when the cursor reaches the loop region, it will loop

**Selection + Loop Interaction:**
- With a selection and **no loop**: Play starts at selection start and stops at selection end
- With a selection and **loop enabled**: Play starts at selection start and continues, looping when it reaches the loop region

## Selection Playback

Play only the selected region:

```tsx
import { useSelection, usePlaybackControls } from '@waveform-playlist/browser';

function PlaySelection() {
  const { selectionStart, selectionEnd } = useSelection();
  const { play } = usePlaybackControls();

  const playSelectedRegion = () => {
    if (selectionStart !== selectionEnd) {
      play(selectionStart, selectionEnd - selectionStart);
    }
  };

  return (
    <button onClick={playSelectedRegion} disabled={selectionStart === selectionEnd}>
      Play Selection
    </button>
  );
}
```

## Master Volume

Control the overall output volume:

```tsx
import { MasterVolumeControl } from '@waveform-playlist/browser';

function VolumeControl() {
  return <MasterVolumeControl />;
}
```

Or with a custom UI:

```tsx
import { usePlaylistMixer, useEditorControls } from '@waveform-playlist/browser';

function CustomVolumeSlider() {
  const { masterVolume } = usePlaylistMixer();
  const { setMasterVolume } = useEditorControls();

  return (
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={masterVolume}
      onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
    />
  );
}
```

## Keyboard Shortcuts

`<KeyboardShortcuts>` works under `WaveformPlaylistProvider` only. Nothing in the library installs keyboard shortcuts under `MediaElementPlaylistProvider`.

Waveform Playlist supports common keyboard shortcuts:

| Key | Action |
|-----|--------|
| Space | Play/Pause toggle. Starts playback exactly as the Play button does: the highlighted selection if there is one (and looping is off), otherwise from the cursor. If the cursor is inside the selection (playback was paused there, for example), both resume from the cursor and stop at the selection's end; Stop, or the selection finishing, returns the cursor to the selection's start |
| Home | Go to start |
| End | Go to end |

### Shortcuts and focused controls

A shortcut does not fire for a key that the focused control uses itself:

- Text fields, sliders, checkboxes and every other `<input>`, `<textarea>`, `<select>` dropdowns and `contenteditable` elements keep every key.
- `Escape` closes an open modal dialog (`<dialog>` opened with `showModal()`, or an `aria-modal="true"` container) and does not also stop playback, wherever focus is.
- `Space` and `Enter` go to a focused `<button>` or `<summary>`, and `Enter` to a focused link.

While a text field, slider, checkbox or dropdown has focus, no shortcut fires at all, including undo and split.

How the control got focus makes no difference. A control you clicked still has focus, so it behaves as it would on any other page: after clicking Mute, `Space` toggles Mute again; after picking a value from a dropdown, `Space` opens the dropdown. `Space` is play/pause when focus is not on a control. Click an empty part of the page, or press `Tab`, to move focus off one.

The built-in Play, Pause and Stop buttons are disabled while they do not apply (Play while playing, for example), so focus leaves them when you click them and `Space` keeps working as play/pause.

Elements that are only given a role (`<div role="button">`) are not covered: a shortcut still fires while one has focus.

This applies to every shortcut handled through `useKeyboardShortcuts` / `<KeyboardShortcuts>`, including `additionalShortcuts`, and looks through shadow DOM.

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
  SetLoopRegionButton,
  LoopButton,
  MasterVolumeControl,
  AudioPosition,
  TimeFormatSelect,
  AutomaticScrollCheckbox,
  ContinuousPlayCheckbox,
  useAudioTracks,
} from '@waveform-playlist/browser';

function FullPlaybackExample() {
  const { tracks, loading } = useAudioTracks([
    { src: '/audio/track.mp3', name: 'Track' },
  ]);

  if (loading) return <div>Loading...</div>;

  return (
    <WaveformPlaylistProvider tracks={tracks} timescale>
      <div style={{ display: 'flex', gap: '1rem', padding: '1rem' }}>
        <RewindButton />
        <PlayButton />
        <PauseButton />
        <StopButton />
        <FastForwardButton />
        <SetLoopRegionButton />
        <LoopButton />
        <MasterVolumeControl />
        <TimeFormatSelect />
        <AudioPosition />
        <AutomaticScrollCheckbox />
        <ContinuousPlayCheckbox />
      </div>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

## Next Steps

- [Track Management](/docs/react/guides/track-management) - Control individual tracks
- [Audio Effects](/docs/react/guides/effects) - Add effects to playback
