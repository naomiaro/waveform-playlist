---
sidebar_position: 14
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

Use `WaveformPlaylistProvider` (Tone.js) when you need multi-track mixing, sample-accurate timing, or recording. For audio effects, the MediaElement provider supports bridging into Tone.js — see [Web Audio Routing](#web-audio-routing) below.

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

`PlayheadWithMarker` adds a triangle marker above the playhead line. You can also write your own — the render function receives `PlayheadProps` (see [API reference](/docs/llm-reference)). In the MediaElement context, use `currentTimeRef` for animation; `playbackStartTimeRef` and `audioStartPositionRef` are not applicable.

## Web Audio Routing

Pass an `AudioContext` to enable Web Audio routing. This routes audio through a gain chain (`HTMLAudioElement → MediaElementSourceNode → fadeGain → volumeGain → destination`) enabling fades and effects.

### Fades

Configure fade in/out on the track config. Requires `audioContext`:

```tsx
// Memoized: the provider creates its player again (and stops playback) when a
// fade object gets a new identity, so the track must not be rebuilt per render.
const track = useMemo(
  () => ({
    source: '/audio/track.mp3',
    waveformData,
    name: 'My Track',
    fadeIn: { duration: 1.5, type: 'logarithmic' as const },
    fadeOut: { duration: 1.5, type: 'sCurve' as const },
  }),
  [waveformData]
);

<MediaElementPlaylistProvider track={track} audioContext={audioContext}>
  <MediaElementWaveform showFades />
</MediaElementPlaylistProvider>;
```

Fade types: `'linear'`, `'logarithmic'`, `'exponential'`, `'sCurve'`. See the [Fades example](/examples/fades) for a comparison of all four curves.

### Tone.js Effects

Bridge the MediaElement output into a Tone.js effect chain using a `Tone.Gain` node. Pass `getGlobalAudioContext()` to the provider so native nodes and Tone.js nodes share the same audio graph:

```tsx
import { getGlobalAudioContext } from '@waveform-playlist/playout';

// Pass the global AudioContext to the provider:
// <MediaElementPlaylistProvider audioContext={getGlobalAudioContext()}>

// Inside a child component of MediaElementPlaylistProvider:
function EffectWiring() {
  const { playoutRef, isReady } = useMediaElementData();
  const audioContext = getGlobalAudioContext();

  useEffect(() => {
    const outputNode = playoutRef.current?.outputNode;
    if (!outputNode) return;

    let bridge, crusher, disposed = false;

    const wireEffect = async () => {
      // Dynamic import avoids AudioWorklet errors on page load.
      // Tone.js must be imported after a user gesture (AudioContext running).
      const Tone = await import('tone');
      if (disposed) return;

      bridge = new Tone.Gain(1);
      crusher = new Tone.BitCrusher({ bits: 4, wet: 1 });

      // Disconnect from default destination
      outputNode.disconnect();

      // Native → native (outputNode → bridge.input is a native GainNode)
      outputNode.connect(bridge.input);

      // Tone → Tone chain (bridge → crusher → destination)
      bridge.chain(crusher, Tone.getDestination());
    };

    // Wait for AudioContext to be running (after user gesture)
    const onStateChange = () => {
      if (audioContext.state === 'running') {
        audioContext.removeEventListener('statechange', onStateChange);
        wireEffect();
      }
    };

    if (audioContext.state === 'running') {
      wireEffect();
    } else {
      audioContext.addEventListener('statechange', onStateChange);
    }

    return () => {
      disposed = true;
      audioContext.removeEventListener('statechange', onStateChange);
      if (bridge) {
        try { outputNode.disconnect(); } catch { /* may already be disconnected */ }
        try { outputNode.connect(audioContext.destination); } catch { /* fallback */ }
      }
      crusher?.dispose();
      bridge?.dispose();
    };
  }, [playoutRef, audioContext, isReady]);

  return null;
}
```

**Tip:** If you're also using Tone.js for playback (e.g., MIDI/SoundFont), use `getGlobalAudioContext()` to share the same context. Avoid calling `Tone.setContext()` with a context you close on unmount — that replaces Tone's global state and can break other features.

The key insight: `Tone.Gain.input` is a native `GainNode`, so `outputNode.connect(bridge.input)` is a standard Web Audio native-to-native connection. From the bridge onward, Tone.js manages the effect chain. Tone.js must be dynamically imported (`await import('tone')`) after the `AudioContext` is running to avoid AudioWorklet errors on suspended contexts. See the [Media Element example](/examples/media-element) for a working demo.

## Playback Rules

The controls follow the same rules as `WaveformPlaylistProvider`'s:

- `stop()`, the audio reaching its end, and an annotation reaching its end with continuous play off all return the cursor to where playback started. `seekTo(0)` rewinds.
- `play(start, duration)` plays a range and stops; the cursor rests at the end of the range. When the range starts inside the highlighted selection and ends at its end, the cursor returns to the start of the selection instead.
- `play()` called before the player exists is queued and starts when the player arrives.
- `seekTo(time)` during playback restarts playback at `time`.
- A drag on the waveform highlights a range and moves the cursor to its start. During playback a press moves playback there and a drag selects nothing.
- `duration` is the length from the track's waveform data and is known from the first render. `isReady` (and the `onReady` prop) tell you that the media element has loaded; `onError` tells you that it could not.

## Context Hooks

`MediaElementPlaylistProvider` uses 4 split contexts, matching the pattern of `WaveformPlaylistProvider`:

| Hook | Frequency | Key returns |
|------|-----------|-------------|
| `useMediaElementAnimation()` | On play/pause/stop/seek | `isPlaying`, `currentTime`, `currentTimeRef` (ref updates at 60fps) |
| `useMediaElementState()` | Medium | `playbackRate`, `annotations`, `activeAnnotationId`, `continuousPlay`, `isAutomaticScroll` |
| `useMediaElementControls()` | Stable | `play`, `pause`, `stop`, `seekTo`, `setPlaybackRate`, `setAnnotations`, `annotationPreview`, `setActiveAnnotationId`, `setContinuousPlay`, `setAutomaticScroll` |
| `useMediaElementData()` | Stable | `duration`, `isReady`, `peaksDataArray`, `sampleRate`, `samplesPerPixel`, `waveHeight`, `timeScaleHeight`, `controls`, `barWidth`, `barGap`, `roundedBars`, `fadeIn`, `fadeOut`, `playoutRef` |

## Live Example

See the [Media Element Playout example](/examples/media-element) for a working demo with playback rate controls and custom playhead. The [Media Element Annotations example](/examples/media-element-annotations) adds annotation boxes and the annotation list to a streamed track.
