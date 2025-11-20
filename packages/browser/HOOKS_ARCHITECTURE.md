# Waveform Playlist Hooks Architecture

## Overview

The waveform playlist has been refactored to use a **custom hooks architecture** that separates business logic from UI presentation. This allows users to:

1. **Use the provided hooks** to build completely custom UIs
2. **Use render props** to inject custom components
3. **Compose hooks** for specific functionality
4. **Maintain backward compatibility** with existing HTML-based controls

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   WaveformPlaylistComponent                  │
│  (Main component - handles audio loading, state management)  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ exposes
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      Custom Hooks Layer                      │
├─────────────────────────────────────────────────────────────┤
│  • usePlaybackControls  - play/pause/stop/seek             │
│  • useTimeFormat        - time formatting & display         │
│  • useZoomControls      - zoom in/out functionality         │
│  • useAudioPosition     - current time display              │
│  • useWaveformPlaylist  - composite hook (all of above)     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ used by
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    User's Custom UI                          │
│  (Users can build any UI using the hooks + render props)    │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
packages/browser/src/
├── hooks/
│   ├── usePlaybackControls.ts   # Play/pause/stop/seek logic
│   ├── useTimeFormat.ts         # Time format management
│   ├── useZoomControls.ts       # Zoom in/out logic
│   ├── useAudioPosition.ts      # Audio position display
│   ├── useWaveformPlaylist.ts   # Composite hook
│   ├── index.ts                 # Exports
│   └── README.md                # Documentation
├── components/
│   └── DefaultPlaylistControls.tsx  # Default control component
├── examples/
│   └── CustomControlsExample.tsx    # Example custom UI
└── WaveformPlaylistComponent.tsx    # Main component
```

## Usage Examples

### 1. Using Individual Hooks

```typescript
import { usePlaybackControls, useTimeFormat } from '@waveform-playlist/browser/hooks';

function MyCustomPlayer() {
  const playoutRef = useRef<TonePlayout>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const playback = usePlaybackControls({
    playoutRef,
    onPlayStart: () => setIsPlaying(true),
    onPause: () => setIsPlaying(false),
  });

  const { formatTime } = useTimeFormat();

  return (
    <div>
      <button onClick={() => playback.play()}>
        {isPlaying ? '⏸' : '▶'}
      </button>
      <span>{formatTime(currentTime)}</span>
    </div>
  );
}
```

### 2. Using Composite Hook

```typescript
import { useWaveformPlaylist } from '@waveform-playlist/browser/hooks';

function MyPlayer() {
  const controls = useWaveformPlaylist({
    playoutRef,
    isPlaying,
    currentTime,
    duration,
    selectionStart,
    selectionEnd,
    initialSamplesPerPixel: 1000,
  });

  return (
    <div>
      {/* Playback controls */}
      <button onClick={controls.playback.play}>Play</button>
      <button onClick={controls.playback.pause}>Pause</button>

      {/* Zoom controls */}
      <button onClick={controls.zoom.zoomIn}>+</button>
      <button onClick={controls.zoom.zoomOut}>-</button>

      {/* Time display */}
      <span>{controls.timeFormat.formatTime(controls.state.currentTime)}</span>
    </div>
  );
}
```

### 3. With Render Props (Future Enhancement)

```typescript
<WaveformPlaylist
  tracks={tracks}
  renderControls={(controls) => (
    <MyCustomControls
      onPlay={controls.playback.play}
      isPlaying={controls.state.isPlaying}
      currentTime={controls.state.currentTime}
    />
  )}
  renderTrackControls={(track, controls) => (
    <MyTrackControls
      track={track}
      onMute={controls.toggleMute}
      onVolumeChange={controls.setVolume}
    />
  )}
/>
```

## Key Benefits

### 1. **Separation of Concerns**
- Logic is extracted into reusable hooks
- UI can be completely customized
- No more `document.querySelector` scattered throughout

### 2. **Type Safety**
- Full TypeScript support
- Auto-completion for all controls
- Compile-time error checking

### 3. **Flexibility**
- Build any UI you want
- Use your own component library
- Integrate with your design system

### 4. **Testability**
- Hooks can be tested independently
- Business logic separated from presentation
- Easy to mock and test

### 5. **Backward Compatibility**
- Existing HTML structure still works
- `useAudioPosition` updates `.audio-pos` element
- Can migrate incrementally

## Migration Path

### Phase 1: ✅ **COMPLETE** - Extract Hooks
- Create individual hooks for each concern
- Create composite hook
- Add TypeScript types
- Write documentation

### Phase 2: **IN PROGRESS** - Add Render Props Support
- Add `renderControls` prop to WaveformPlaylist
- Add `renderTrackControls` prop
- Create default components
- Maintain backward compatibility

### Phase 3: **PLANNED** - Refactor Existing Code
- Update WaveformPlaylistComponent to use hooks internally
- Remove direct DOM queries where possible
- Use render props for new examples

### Phase 4: **PLANNED** - Additional Hooks
- `useTrackControls` - individual track management
- `useSelection` - selection state management
- `useAnnotations` - annotation CRUD operations
- `useKeyboardShortcuts` - keyboard controls

## Example: Building a Custom Player

See [CustomControlsExample.tsx](./src/examples/CustomControlsExample.tsx) for a complete example showing:
- Custom styled buttons
- Progress bar
- Time display
- Zoom slider
- Selection info

## API Reference

See [hooks/README.md](./src/hooks/README.md) for complete API documentation.

## Next Steps

Users can now:
1. Import the hooks they need
2. Build custom UIs with full control
3. Use the hooks with any React component library
4. Share and reuse custom control components

The architecture is designed to be:
- **Extensible** - Easy to add new hooks
- **Composable** - Hooks can be combined
- **Flexible** - Works with any UI framework
- **Progressive** - Can be adopted incrementally
