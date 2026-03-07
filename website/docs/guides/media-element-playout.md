---
sidebar_position: 13
description: "Single-track playback with HTMLAudioElement, pitch-preserving speed control, and pre-computed peaks"
---

# Media Element Playout

Use `MediaElementPlaylistProvider` for single-track playback via `HTMLAudioElement`. Audio streams without downloading the entire file, and playback rate changes preserve pitch.

## When to Use

Choose `MediaElementPlaylistProvider` over `WaveformPlaylistProvider` when you need:

- **Large audio files** — streams audio without downloading the entire file first
- **Pre-computed peaks** — use [audiowaveform](https://github.com/bbc/audiowaveform) to generate peaks server-side
- **Playback rate control** — 0.5x to 2.0x speed with pitch preservation
- **Single-track playback** — simpler API, smaller bundle (no Tone.js)

Use `WaveformPlaylistProvider` (Tone.js) when you need multi-track mixing, audio effects, sample-accurate timing, or recording.

## Basic Usage

```tsx
import {
  MediaElementPlaylistProvider,
  useMediaElementAnimation,
  useMediaElementControls,
  MediaElementWaveform,
  loadWaveformData,
} from '@waveform-playlist/browser';

function MyPlayer() {
  const [waveformData, setWaveformData] = useState(null);

  useEffect(() => {
    loadWaveformData('/peaks/audio.dat').then(setWaveformData);
  }, []);

  if (!waveformData) return <div>Loading...</div>;

  return (
    <MediaElementPlaylistProvider
      track={{
        source: '/audio/track.mp3',
        waveformData,
        name: 'My Track',
      }}
      samplesPerPixel={512}
      waveHeight={100}
    >
      <PlaybackControls />
      <MediaElementWaveform />
    </MediaElementPlaylistProvider>
  );
}

function PlaybackControls() {
  const { isPlaying } = useMediaElementAnimation();
  const { play, pause, setPlaybackRate } = useMediaElementControls();

  return (
    <div>
      <button onClick={() => play()} disabled={isPlaying}>Play</button>
      <button onClick={() => pause()} disabled={!isPlaying}>Pause</button>
      <button onClick={() => setPlaybackRate(0.5)}>0.5x</button>
      <button onClick={() => setPlaybackRate(1)}>1x</button>
      <button onClick={() => setPlaybackRate(2)}>2x</button>
    </div>
  );
}
```

## Custom Playhead

Pass a `renderPlayhead` function to `MediaElementWaveform` to replace the default vertical line with a custom playhead component:

```tsx
import { PlayheadWithMarker } from '@waveform-playlist/ui-components';

<MediaElementWaveform renderPlayhead={PlayheadWithMarker} />
```

`PlayheadWithMarker` adds a triangle marker above the playhead line. You can also write your own — the render function receives `PlayheadProps` (see [API reference](/docs/api/llm-reference)). In the MediaElement context, use `currentTimeRef` for animation; `playbackStartTimeRef` and `audioStartPositionRef` are not applicable.

## Context Hooks

`MediaElementPlaylistProvider` uses 4 split contexts, matching the pattern of `WaveformPlaylistProvider`:

| Hook | Frequency | Key returns |
|------|-----------|-------------|
| `useMediaElementAnimation()` | On play/pause/stop/seek | `isPlaying`, `currentTime`, `currentTimeRef` (ref updates at 60fps) |
| `useMediaElementState()` | Medium | `playbackRate`, `annotations`, `activeAnnotationId`, `continuousPlay`, `isAutomaticScroll` |
| `useMediaElementControls()` | Stable | `play`, `pause`, `stop`, `seekTo`, `setPlaybackRate`, `setAnnotations`, `setActiveAnnotationId`, `setContinuousPlay`, `setAutomaticScroll` |
| `useMediaElementData()` | Stable | `duration`, `peaksDataArray`, `sampleRate`, `samplesPerPixel`, `waveHeight`, `timeScaleHeight`, `controls`, `barWidth`, `barGap` |

## Live Example

See the [Media Element Playout example](/examples/media-element) for a working demo with playback rate controls and custom playhead.
