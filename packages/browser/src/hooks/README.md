# Waveform Playlist Hooks

Custom React hooks for building waveform playlist UIs with full control over the interface.

## Overview

These hooks extract the logic from the WaveformPlaylist component, allowing you to:
- Create fully custom UIs with your own components
- Use render props to inject custom controls
- Compose multiple hooks for specific functionality
- Maintain full type safety with TypeScript

## Individual Hooks

### `usePlaybackControls`

Controls audio playback (play, pause, stop, seek).

```typescript
import { usePlaybackControls } from './hooks';

const controls = usePlaybackControls({
  playoutRef,
  onPlayStart: () => setIsPlaying(true),
  onPause: (time) => setIsPlaying(false),
  onStop: () => { setIsPlaying(false); setCurrentTime(0); },
});

// Use the controls
<button onClick={() => controls.play()}>Play</button>
<button onClick={() => controls.pause()}>Pause</button>
<button onClick={() => controls.stop()}>Stop</button>
<button onClick={() => controls.seekTo(30)}>Skip to 30s</button>
```

### `useTimeFormat`

Manages time format (hh:mm:ss, seconds, etc.) and provides formatting function.

```typescript
import { useTimeFormat } from './hooks';

const { timeFormat, formatTime } = useTimeFormat();

// Display current time in selected format
<span>{formatTime(currentTime)}</span>

// Time format automatically syncs with .time-format dropdown in the DOM
```

### `useZoomControls`

Controls zoom level (samples per pixel).

```typescript
import { useZoomControls } from './hooks';

const zoom = useZoomControls({
  initialSamplesPerPixel: 1000,
  zoomLevels: [256, 512, 1024, 2048, 4096],
});

<button onClick={zoom.zoomIn} disabled={!zoom.canZoomIn}>
  Zoom In
</button>
<button onClick={zoom.zoomOut} disabled={!zoom.canZoomOut}>
  Zoom Out
</button>
<span>Current: {zoom.samplesPerPixel} samples/px</span>
```

### `useAudioPosition`

Updates the audio position display element (backward compatibility).

```typescript
import { useAudioPosition } from './hooks';

// Automatically updates .audio-pos element
useAudioPosition({
  currentTime,
  formatTime,
  selector: '.audio-pos', // optional, defaults to '.audio-pos'
});
```

## Composite Hook

### `useWaveformPlaylist`

Combines all hooks into a single interface for convenience.

```typescript
import { useWaveformPlaylist } from './hooks';

const controls = useWaveformPlaylist({
  playoutRef,
  isPlaying,
  currentTime,
  duration,
  selectionStart,
  selectionEnd,
  initialSamplesPerPixel: 1000,
  onPlayStart: () => setIsPlaying(true),
  onPause: (time) => { setIsPlaying(false); setCurrentTime(time); },
  onStop: () => { setIsPlaying(false); setCurrentTime(0); },
});

// Access all controls
controls.playback.play();
controls.zoom.zoomIn();
const formatted = controls.timeFormat.formatTime(123.456);
```

## Using with Custom Components

### Example 1: Simple Custom Controls

```typescript
import React from 'react';
import { useWaveformPlaylist } from './hooks';

const MyControls = ({ controls }) => {
  const { playback, state } = controls;

  return (
    <div>
      <button onClick={() => playback.play()}>
        {state.isPlaying ? '⏸ Pause' : '▶ Play'}
      </button>
      <button onClick={playback.stop}>⏹ Stop</button>
      <span>{state.currentTime.toFixed(2)}s</span>
    </div>
  );
};
```

### Example 2: Render Props Pattern

```typescript
<WaveformPlaylist
  tracks={tracks}
  renderControls={(controls) => (
    <MyCustomControls
      onPlay={controls.playback.play}
      onPause={controls.playback.pause}
      isPlaying={controls.state.isPlaying}
      currentTime={controls.state.currentTime}
      formatTime={controls.timeFormat.formatTime}
    />
  )}
/>
```

### Example 3: Custom Track Controls

```typescript
<WaveformPlaylist
  tracks={tracks}
  renderTrackControls={(track, index, trackControls) => (
    <div>
      <h3>{track.name}</h3>
      <button onClick={() => trackControls.toggleMute(index)}>
        {trackControls.isMuted(index) ? '🔇' : '🔊'}
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={trackControls.getVolume(index)}
        onChange={(e) => trackControls.setVolume(index, parseFloat(e.target.value))}
      />
    </div>
  )}
/>
```

## Migration Guide

### Before (DOM queries)

```typescript
// Old approach - querying DOM elements
const playButton = document.querySelector('.btn-play');
playButton?.addEventListener('click', () => {
  playout.play();
});
```

### After (Hooks + Custom UI)

```typescript
// New approach - React hooks with custom components
const controls = usePlaybackControls({ playoutRef });

<button onClick={controls.play}>Play</button>
```

## Benefits

1. **Separation of Concerns**: Logic is separate from UI
2. **Reusability**: Use the same logic with different UIs
3. **Type Safety**: Full TypeScript support
4. **Testability**: Hooks can be tested independently
5. **Flexibility**: Build any UI you want
6. **Backward Compatible**: Still works with existing HTML structure

## See Also

- [DefaultPlaylistControls.tsx](../components/DefaultPlaylistControls.tsx) - Example default controls component
- [CustomControlsExample.tsx](../examples/CustomControlsExample.tsx) - Example custom controls with styling
