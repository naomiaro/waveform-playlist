---
sidebar_position: 2
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

These buttons automatically connect to the playlist context and update their state accordingly.

## usePlaybackControls Hook

For custom UI, use the `usePlaybackControls` hook:

```tsx
import { usePlaybackControls } from '@waveform-playlist/browser';

function CustomControls() {
  const {
    play,
    pause,
    stop,
    isPlaying,
    isPaused,
  } = usePlaybackControls();

  return (
    <div>
      <button onClick={play} disabled={isPlaying}>
        Play
      </button>
      <button onClick={pause} disabled={!isPlaying}>
        Pause
      </button>
      <button onClick={stop}>
        Stop
      </button>
      <span>Status: {isPlaying ? 'Playing' : isPaused ? 'Paused' : 'Stopped'}</span>
    </div>
  );
}
```

## Seeking

### Click-to-Seek

By default, clicking on the waveform seeks to that position.

### Programmatic Seeking

```tsx
import { usePlaylistControls } from '@waveform-playlist/browser';

function SeekControls() {
  const { seek } = usePlaylistControls();

  return (
    <div>
      <button onClick={() => seek(0)}>Go to Start</button>
      <button onClick={() => seek(30)}>Go to 0:30</button>
      <button onClick={() => seek(60)}>Go to 1:00</button>
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
// Displays: "0:00.000 / 3:45.123"
```

### usePlaylistState Hook

Access position programmatically:

```tsx
import { usePlaylistState } from '@waveform-playlist/browser';

function CustomPosition() {
  const { cursorPosition, duration } = usePlaylistState();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <span>
      {formatTime(cursorPosition)} / {formatTime(duration)}
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
import { usePlaylistState, usePlaylistControls } from '@waveform-playlist/browser';

function ContinuousPlayToggle() {
  const { isContinuousPlay } = usePlaylistState();
  const { setIsContinuousPlay } = usePlaylistControls();

  return (
    <label>
      <input
        type="checkbox"
        checked={isContinuousPlay}
        onChange={(e) => setIsContinuousPlay(e.target.checked)}
      />
      Loop
    </label>
  );
}
```

## Automatic Scroll

Keep the playhead visible during playback:

```tsx
import { AutomaticScrollCheckbox } from '@waveform-playlist/browser';

function ScrollControl() {
  return <AutomaticScrollCheckbox />;
}
```

## Selection Playback

Play only the selected region:

```tsx
import { usePlaylistState, usePlaybackControls } from '@waveform-playlist/browser';

function PlaySelection() {
  const { selection } = usePlaylistState();
  const { play } = usePlaybackControls();

  const playSelectedRegion = () => {
    if (selection.start !== selection.end) {
      play(selection.start, selection.end);
    }
  };

  return (
    <button onClick={playSelectedRegion} disabled={selection.start === selection.end}>
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
import { usePlaylistState, usePlaylistControls } from '@waveform-playlist/browser';

function CustomVolumeSlider() {
  const { masterVolume } = usePlaylistState();
  const { setMasterVolume } = usePlaylistControls();

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

Waveform Playlist supports common keyboard shortcuts:

| Key | Action |
|-----|--------|
| Space | Play/Pause toggle |
| Home | Go to start |
| End | Go to end |

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

- [Track Management](/docs/guides/track-management) - Control individual tracks
- [Audio Effects](/docs/guides/effects) - Add effects to playback
