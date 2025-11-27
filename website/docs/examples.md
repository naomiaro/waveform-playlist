---
sidebar_position: 5
---

# Examples

Live examples demonstrating Waveform Playlist features.

## Basic Examples

### Minimal

The simplest possible setup with basic playback controls.

[View Minimal Example](/examples/minimal)

```tsx
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  useAudioTracks,
} from '@waveform-playlist/browser';

function MinimalExample() {
  const { tracks, loading } = useAudioTracks([
    { src: '/audio/track.mp3', name: 'Track' },
  ]);

  if (loading) return <div>Loading...</div>;

  return (
    <WaveformPlaylistProvider tracks={tracks}>
      <PlayButton />
      <PauseButton />
      <StopButton />
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

---

### Stereo

Stereo waveform rendering with separate left and right channels.

[View Stereo Example](/examples/stereo)

Features:
- Separate left (L) and right (R) channel waveforms
- Each stereo track displays two waveform rows
- Use `mono` prop to collapse to single channel

---

### Stem Tracks

Multi-track audio with mute/solo controls for mixing stems.

[View Stem Tracks Example](/examples/stem-tracks)

Features:
- Multiple tracks loaded simultaneously
- Track controls (mute, solo, volume, pan)
- Master volume control
- Time display

---

## Advanced Examples

### Multi-Clip Editing

Demonstrates the clip-based editing model with multiple clips per track.

[View Multi-Clip Example](/examples/multi-clip)

Features:
- Multiple clips on a single track
- Drag clips to reposition
- Trim clips from edges
- Split clips at playhead
- Collision detection

---

### Annotations

Time-synchronized text annotations for podcasts, interviews, and transcription.

[View Annotations Example](/examples/annotations)

Features:
- Create annotations from selection
- Drag to move annotations
- Resize annotation boundaries
- Edit annotation text
- Export/import annotation data

---

### Recording

Record audio directly from the microphone.

[View Recording Example](/examples/recording)

Features:
- Microphone level monitoring
- Real-time waveform preview
- Add recordings to playlist
- Download recorded audio

---

### Effects

Apply audio effects to tracks using Tone.js.

[View Effects Example](/examples/effects)

Features:
- Reverb, delay, distortion
- EQ and compression
- Real-time effect control
- Per-track effect chains

---

## Feature Demonstrations

### BBC Peaks / Waveform Data

Load pre-computed waveform data for instant display of large files.

[View Waveform Data Example](/examples/waveform-data)

Features:
- Instant waveform display
- Background audio loading
- Support for JSON and binary formats

---

### Theming

Light and dark themes with custom colors.

[View Theming Example](/examples/theming)

Features:
- Light/dark mode toggle
- Custom color schemes
- Docusaurus theme integration

---

### Waveform Styling

Customize waveform appearance with bar width, gap controls, and playback styling.

[View Styling Example](/examples/styling)

Features:
- `barWidth` - Control the width of waveform bars
- `barGap` - Add spacing between bars
- `waveProgressColor` - Colored fill behind played portion
- `playheadColor` - Vertical line at playback position
- `selectedWaveOutlineColor` / `selectedWaveFillColor` - Colors when track is selected
- SoundCloud-style waveforms
- Multiple theme color combinations

---

### Flexible API

Advanced usage showing programmatic control.

[View Flexible API Example](/examples/flexible-api)

Features:
- Custom controls
- Programmatic playback
- State management integration
- Event handling

---

## Code Patterns

### File Upload

```tsx
function FileUploader() {
  const [audioConfigs, setAudioConfigs] = useState([]);
  const { tracks, loading } = useAudioTracks(audioConfigs);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioConfigs([
        { src: URL.createObjectURL(file), name: file.name },
      ]);
    }
  };

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

### Keyboard Shortcuts

```tsx
function KeyboardShortcuts() {
  const { play, pause, stop, isPlaying } = usePlaybackControls();
  const { seek } = usePlaylistControls();

  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          isPlaying ? pause() : play();
          break;
        case 'Home':
          seek(0);
          break;
        case 'Escape':
          stop();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [play, pause, stop, seek, isPlaying]);

  return null;
}
```

### Save/Load State

```tsx
function SaveLoadState() {
  const { tracks, cursorPosition, samplesPerPixel } = usePlaylistState();
  const { setSamplesPerPixel, seek } = usePlaylistControls();

  const saveState = () => {
    const state = {
      cursorPosition,
      samplesPerPixel,
      trackStates: tracks.map((t) => ({
        name: t.name,
        muted: t.muted,
        soloed: t.soloed,
        volume: t.volume,
        pan: t.pan,
      })),
    };
    localStorage.setItem('playlistState', JSON.stringify(state));
  };

  const loadState = () => {
    const saved = localStorage.getItem('playlistState');
    if (saved) {
      const state = JSON.parse(saved);
      seek(state.cursorPosition);
      setSamplesPerPixel(state.samplesPerPixel);
      // Restore track states...
    }
  };

  return (
    <div>
      <button onClick={saveState}>Save State</button>
      <button onClick={loadState}>Load State</button>
    </div>
  );
}
```

### External Transport Control

```tsx
function ExternalTransport() {
  const { play, pause, stop, seek } = usePlaylistControls();
  const { cursorPosition, isPlaying, duration } = usePlaylistState();

  // Expose controls globally
  useEffect(() => {
    window.waveformPlaylist = {
      play,
      pause,
      stop,
      seek,
      getPosition: () => cursorPosition,
      isPlaying: () => isPlaying,
    };

    return () => {
      delete window.waveformPlaylist;
    };
  }, [play, pause, stop, seek, cursorPosition, isPlaying]);

  return null;
}
```

---

## Running Examples Locally

Clone the repository and run the development server:

```bash
git clone https://github.com/naomiaro/waveform-playlist.git
cd waveform-playlist
pnpm install
pnpm dev
```

Visit `http://localhost:3000` to see the examples.

## See Also

- [Getting Started](/docs/getting-started/installation)
- [API Reference](/docs/api/provider)
- [GitHub Repository](https://github.com/naomiaro/waveform-playlist)
