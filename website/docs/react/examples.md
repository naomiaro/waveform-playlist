---
sidebar_position: 3
description: "Interactive demos of multitrack editing, effects, recording, annotations, and waveform visualization"
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
} from '@waveform-playlist/browser';
import { useAudioTracks } from '@waveform-playlist/browser/tone';

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
- Add an annotation at the playhead
- Click a box or a row of the list to play an annotation
- Move annotation boundaries by dragging the edges of a box
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

### WAM! Kick It Up a Notch

Host third-party [Web Audio Modules (WAM 2.0)](https://www.webaudiomodules.com/) plugins alongside the built-in Tone.js effects — community plugin browser, native plugin GUIs, master and per-track chains.

[View WAM! Kick It Up a Notch](/examples/wam-effects)

```tsx
import { WaveformPlaylistProvider, Waveform, type ClipTrack } from '@waveform-playlist/browser';
import {
  useDynamicEffects,
  useActiveEffects,
  WamEffectGui,
  type UseDynamicEffectsReturn,
} from '@waveform-playlist/browser/tone';

const DELAY_URL =
  'https://www.webaudiomodules.com/community/plugins/burns-audio/delay/index.js';

function App({ tracks }: { tracks: ClipTrack[] }) {
  // One useDynamicEffects() call owns the master chain; pass its result down.
  const masterFx = useDynamicEffects();

  return (
    <WaveformPlaylistProvider tracks={tracks} effects={masterFx.masterEffects}>
      <MasterRack masterFx={masterFx} />
      <Waveform />
    </WaveformPlaylistProvider>
  );
}

function MasterRack({ masterFx }: { masterFx: UseDynamicEffectsReturn }) {
  const { effects, addWamEffect, getWamPlugin } = masterFx;
  const activeEffects = useActiveEffects(effects);

  return (
    <div>
      <button onClick={() => addWamEffect(DELAY_URL).catch(console.error)}>+ Simple Delay</button>
      {activeEffects.map((effect) =>
        effect.kind === 'wam' ? (
          <WamEffectGui key={effect.instanceId} plugin={getWamPlugin(effect.instanceId)} />
        ) : null
      )}
    </div>
  );
}
```

See the [WAM Plugins guide](/docs/wam-plugins) for native-context setup, bypass semantics, and plugin discovery.

Features:
- WAM 2.0 plugin hosting on a native AudioContext
- Community plugin browser (`fetchWamLibrary`)
- Mixed chains — Tone.js effects alongside hosted WAM plugins
- Native plugin GUIs with generic-panel fallback

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

### Waveform Styling

Customize waveform appearance with bar width, gap controls, theming, and playback styling.

[View Styling Example](/examples/styling)

Features:
- Light/dark mode support with Docusaurus theme integration
- `barWidth` - Control the width of waveform bars
- `barGap` - Add spacing between bars
- `roundedBars` - Pill-shaped bar caps (radius `barWidth / 2`)
- `waveProgressColor` - Colored fill behind played portion
- `playheadColor` - Vertical line at playback position
- `selectedWaveOutlineColor` / `selectedWaveFillColor` - Colors when track is selected
- SoundCloud-style waveforms
- Custom color schemes and gradients

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
import { KeyboardShortcuts } from '@waveform-playlist/browser';

// Declarative — just enable the features you want
<WaveformPlaylistProvider tracks={tracks} {...}>
  <KeyboardShortcuts playback clipSplitting undo />
  <Waveform />
</WaveformPlaylistProvider>

// With custom shortcuts
<KeyboardShortcuts
  playback
  additionalShortcuts={[
    { key: 'r', action: startRecording, description: 'Record' },
  ]}
/>
```

### Save/Load State

```tsx
// Zoom is not saved: there is no setter for samplesPerPixel (only zoomIn /
// zoomOut), so a saved zoom level could not be restored.
function SaveLoadState() {
  const { tracks } = usePlaylistTimeline();
  // trackStates[i] is the { name, muted, soloed, volume, pan } of tracks[i];
  // undefined while that track is still loading
  const { trackStates } = usePlaylistMixer();
  // The ref, not useCurrentTime(): the position is only read when Save is pressed
  const { currentTimeRef } = usePlaybackRefs();
  const { seekTo } = usePlaybackControls();
  const { setTrackMute, setTrackSolo, setTrackVolume, setTrackPan } = useEditorControls();

  const saveState = () => {
    const state = {
      cursorPosition: currentTimeRef.current ?? 0,
      // Saved by track id: a position is not an identity.
      mixer: tracks.flatMap((track, i) => {
        const state = trackStates[i];
        return state ? [{ id: track.id, ...state }] : [];
      }),
    };
    localStorage.setItem('playlistState', JSON.stringify(state));
  };

  const loadState = () => {
    const saved = localStorage.getItem('playlistState');
    if (saved) {
      const state = JSON.parse(saved);
      seekTo(state.cursorPosition);
      // The setters take a track id and ignore an id no track has.
      state.mixer.forEach((t: { id: string } & (typeof trackStates)[number]) => {
        setTrackMute(t.id, t.muted);
        setTrackSolo(t.id, t.soloed);
        setTrackVolume(t.id, t.volume);
        setTrackPan(t.id, t.pan);
      });
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
// TypeScript needs to know about the global this component sets
declare global {
  interface Window {
    waveformPlaylist?: {
      play: () => void;
      pause: () => void;
      stop: () => void;
      seekTo: (time: number) => void;
      getPosition: () => number;
      isPlaying: () => boolean;
    };
  }
}

function ExternalTransport() {
  const { play, pause, stop, seekTo } = usePlaybackControls();
  // currentTimeRef follows playback; reading it needs no re-render
  const { currentTimeRef } = usePlaybackRefs();
  const { isPlaying } = useIsPlaying();

  // Expose controls globally
  useEffect(() => {
    window.waveformPlaylist = {
      play,
      pause,
      stop,
      seekTo,
      getPosition: () => currentTimeRef.current ?? 0,
      isPlaying: () => isPlaying,
    };

    return () => {
      delete window.waveformPlaylist;
    };
  }, [play, pause, stop, seekTo, currentTimeRef, isPlaying]);

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

- [Getting Started](/docs/react/getting-started/installation)
- [API Reference](/docs/react/api/providers/waveform-playlist-provider)
- [GitHub Repository](https://github.com/naomiaro/waveform-playlist)
