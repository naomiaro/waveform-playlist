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
  MediaElementWaveform,
  WaveformViewOptions,
  PlayButton,
  PauseButton,
  StopButton,
  AudioPosition,
  PlaybackRateSelect,
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
    >
      <PlaybackControls />
      <WaveformViewOptions waveHeight={100}>
        <MediaElementWaveform />
      </WaveformViewOptions>
    </MediaElementPlaylistProvider>
  );
}

function PlaybackControls() {
  return (
    <div>
      <PlayButton />
      <PauseButton />
      <StopButton />
      <AudioPosition />
      <PlaybackRateSelect />
    </div>
  );
}
```

The row height, the bar style and the playhead width are not provider props: they are props of [`<WaveformViewOptions>`](/docs/react/api/components#waveformviewoptions), which sets them for every view below it. It may sit above the provider, so one element can style several players on a page. Without it the row is 80 px tall.

The transport buttons, `AudioPosition`, `TimeFormatSelect`, `SelectionTimeInputs` and `AutomaticScrollCheckbox` are the same components `WaveformPlaylistProvider` uses; each reads the nearest provider, so several players on one page each get their own set. `PlaybackRateSelect` works under `MediaElementPlaylistProvider` only: a `<select>` of speeds (`rates`, default 0.5, 0.75, 1, 1.25, 1.5, 2). See [Playback Controls](./playback-controls.md#which-controls-work-under-which-provider) for the full list.

For custom controls, use the hooks:

```tsx
import { useIsPlaying, usePlaybackControls, usePlaybackRate } from '@waveform-playlist/browser';

function CustomControls() {
  const { isPlaying } = useIsPlaying();
  const { play, pause } = usePlaybackControls();
  const { playbackRate, setPlaybackRate } = usePlaybackRate();

  return (
    <div>
      <button onClick={() => play()} disabled={isPlaying}>Play</button>
      <button onClick={() => pause()} disabled={!isPlaying}>Pause</button>
      <button onClick={() => setPlaybackRate(0.5)} disabled={playbackRate === 0.5}>0.5x</button>
      <button onClick={() => setPlaybackRate(1)} disabled={playbackRate === 1}>1x</button>
      <button onClick={() => setPlaybackRate(2)} disabled={playbackRate === 2}>2x</button>
    </div>
  );
}
```

## Custom Playhead

`<MediaElementWaveform />` is a ready-made composition of the view's parts. To replace the default vertical line with a custom playhead, compose the parts yourself and pass a `renderPlayhead` function to `<WaveformPlayhead>`:

```tsx
import {
  MediaElementWaveformRoot,
  WaveformTimescale,
  WaveformTracks,
  WaveformSelection,
  WaveformPlayhead,
} from '@waveform-playlist/browser';
import { PlayheadWithMarker } from '@waveform-playlist/ui-components';

<MediaElementWaveformRoot>
  <WaveformTimescale />
  <WaveformTracks />
  <WaveformSelection />
  <WaveformPlayhead renderPlayhead={PlayheadWithMarker} />
</MediaElementWaveformRoot>
```

Leave `<WaveformTimescale />` out for a player without a time ruler. With annotations, add `<WaveformAnnotationBoxes />` after the tracks and `<AnnotationList />` below the root: the same two components as under `WaveformPlaylistProvider`. Whether annotations can be edited is the provider's option (`annotationList={{ annotations, editable: true }}`, or `<EditableCheckbox />`); see the [Annotations guide](/docs/react/guides/annotations). See [Composing the View](/docs/react/guides/composing-the-view).

`PlayheadWithMarker` adds a triangle marker above the playhead line. You can also write your own — the render function receives `PlayheadProps` (see [API reference](/docs/llm-reference)). The props are the same as under `WaveformPlaylistProvider`; read `visualTimeRef.current` to animate (here it is the same ref as `currentTimeRef`). The playhead is hidden while a range is highlighted and playback is stopped or paused.

## Web Audio Routing

Pass an `AudioContext` to enable Web Audio routing. This routes audio through a gain chain (`HTMLAudioElement → MediaElementSourceNode → fadeGain → volumeGain → destination`) enabling fades and effects.

### Fades

Configure fade in/out on the track config. Requires `audioContext`:

```tsx
// Memoized: a new `source`, `waveformData` (by identity) or `name` makes the
// provider create its player again, which stops playback. The two fades are
// compared by value (`duration`, `type`), so new but equal fade objects do not.
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
  <MediaElementWaveformRoot>
    <WaveformTracks>
      <WaveformFades />
    </WaveformTracks>
    <WaveformSelection />
    <WaveformPlayhead />
  </MediaElementWaveformRoot>
</MediaElementPlaylistProvider>;
```

`<WaveformFades />` inside `<WaveformTracks>` draws the curves over the waveform; the fades themselves need `audioContext`. Fade types: `'linear'`, `'logarithmic'`, `'exponential'`, `'sCurve'`. See the [Fades example](/examples/fades) for a comparison of all four curves.

### Tone.js Effects

Bridge the MediaElement output into a Tone.js effect chain using a `Tone.Gain` node. Pass `getGlobalAudioContext()` to the provider so native nodes and Tone.js nodes share the same audio graph:

```tsx
import { getGlobalAudioContext } from '@waveform-playlist/playout';

// Pass the global AudioContext to the provider:
// <MediaElementPlaylistProvider audioContext={getGlobalAudioContext()}>

// Inside a child component of MediaElementPlaylistProvider:
function EffectWiring() {
  const { playoutRef, isReady } = useMediaElementTrack();
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
- `play(start, duration)` plays a range and stops; the cursor rests at the end of the range. If an annotation is active and continuous play is off, playback stops at that annotation's end when it comes first.
- `play()` called before the player exists is queued and starts when the player arrives. Do not wait for `isReady` before enabling Play.
- If the media fails during playback, or the browser refuses to start playback (no user gesture), `isPlaying` goes back to `false`. One case is not detected yet: with the `audioContext` prop, while that context is still suspended and the browser leaves its resume pending ([#783](https://github.com/naomiaro/waveform-playlist/issues/783)).
- `seekTo(time)` during playback restarts playback at `time`. A `stop()` while already stopped does not move the cursor.
- `PlayButton` plays a highlighted selection as a range and stops at its end; with no selection it plays from the cursor. There is no loop under this provider.
- `StopButton` is disabled unless playback is running. After Pause the cursor stays at the pause point; `stop()` called from code then still returns it to where playback started.
- The library installs no keyboard shortcuts under this provider: `KeyboardShortcuts` and `usePlaybackShortcuts()` need `WaveformPlaylistProvider` and throw here. `useKeyboardShortcuts()` (it reads no context) and `useAnnotationKeyboardControls()` can be called here by your own component.
- A drag on the waveform highlights a range and moves the cursor to its start. During playback nothing happens until the release: a click moves playback there, and a drag selects a range and plays it (with automatic scroll on, a drag is a seek to where it was pressed).
- `duration` is the length from the track's waveform data and is known from the first render. `isReady` (and the `onReady` prop) tell you that the media element has loaded; `onError` tells you that it could not.

## Context Hooks

`MediaElementPlaylistProvider` publishes what it shares with `WaveformPlaylistProvider` through the same hooks, and adds two of its own:

| Hook | The component re-renders on | Key returns |
|------|-----------|-------------|
| `useIsPlaying()` | play, pause, stop | `isPlaying` |
| `useCurrentTime()` | a seek, a pause, a stop, each move of a leftward selection drag | `currentTime` (where the cursor rests; does not advance during playback) |
| `useSelection()` | each move of a selection drag | `selectionStart`, `selectionEnd` |
| `useActiveAnnotation()` | each annotation boundary during playback | `activeAnnotationId` |
| `useAnnotations()` | an annotation edit | `annotations` |
| `useAnnotationOptions()` | one of the three annotation options being toggled | `editable`, `linkEndpoints`, `continuousPlay` |
| `usePlaybackControls()` | never | `play`, `pause`, `stop`, `seekTo`, `setSelection`, `setTimeFormat`, `setAutomaticScroll`, `setScrollContainer`, `scrollContainerRef`, `setContinuousPlay`, `setAnnotationsEditable`, `setLinkEndpoints`, `setAnnotations`, `annotationPreview`, `setActiveAnnotationId`, `playAnnotation` |
| `usePlaybackRefs()` | never | `currentTimeRef` (advances during playback), `visualTimeRef` (the same ref here), `registerFrameCallback`, `unregisterFrameCallback` |
| `usePlaylistView()` | a provider prop change | `sampleRate` (`mono` and `indefinitePlayback` are always `false` here) |
| `usePlaylistSettings()` | the user changing either setting | `timeFormat`, `isAutomaticScroll` |
| `usePlaylistZoom()` | a zoom level change | `samplesPerPixel` (`canZoomIn` and `canZoomOut` are always `false` here) |
| `usePlaybackRate()` | the speed changing | `playbackRate`, `setPlaybackRate` |
| `useMediaElementTrack()` | the track or the zoom level changing, the player becoming ready | `duration`, `isReady`, `peaksDataArray`, `fadeIn`, `fadeOut`, `playoutRef` |

`usePlaybackRate()` and `useMediaElementTrack()` exist under this provider only. The hooks that only `WaveformPlaylistProvider` serves (`useEditorControls()`, `useEngineRefs()`, `useLoop()`, `usePlaylistTimeline()`, `usePlaylistMixer()` and the others listed in the [hooks reference](/docs/react/api/hooks#core-context-hooks)) throw here.

**Nested providers:** every hook reads the nearest playlist provider. Inside a `MediaElementPlaylistProvider` that is itself inside a `WaveformPlaylistProvider`, `useIsPlaying()` is the media element's, and `useLoop()` throws ("useLoop needs WaveformPlaylistProvider, and the nearest playlist provider here is MediaElementPlaylistProvider, which does not provide it") instead of reading the outer provider. The same holds the other way round for `usePlaybackRate()` and `useMediaElementTrack()`.

## Live Example

See the [Media Element Playout example](/examples/media-element) for a working demo with playback rate controls and custom playhead. The [Media Element Annotations example](/examples/media-element-annotations) adds annotation boxes and the annotation list to a streamed track.
