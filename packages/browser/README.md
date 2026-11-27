# @waveform-playlist/browser

React components, hooks, and context providers for building a multitrack Web Audio editor and player — canvas waveform rendering, clip-based editing, and playback controls on top of Tone.js or a native `HTMLAudioElement`.

## Features

- **Multitrack editor** — `<Waveform />` renders canvas waveforms, per-track controls (mute/solo/volume/pan), a time ruler, and a playhead for any number of tracks. It is a ready-made composition of exported parts (`WaveformRoot`, `WaveformTimescale`, `WaveformTrackControls`, `WaveformTracks`, `WaveformClipHeaders`, `WaveformFades`, `WaveformPlayhead` and more): compose them yourself to choose what is drawn. The control panel of a track is composed too: the children of `<WaveformTrackControls>` are rendered once per track, from the default panel (`DefaultTrackControls`), its pieces (`TrackName`, `TrackMuteButton`, `TrackSoloButton`, `TrackVolumeSlider`, `TrackPanSlider`, `TrackMenuButton`, `TrackRemoveButton`, `TrackReorderGrip`) or your own component, which reads its track with `useTrack()`
- **An arrangement owns the tracks** — `WaveformPlaylistProvider` takes an `arrangement` (from `useCreateArrangement`): the tracks, their mix, the undo history and the loading of the audio the clips name. A track names its audio with `audioTrack({ src })` from `@waveform-playlist/core`; the arrangement fetches and decodes it, and the view draws a placeholder for a clip still loading when its length is known
- **Clip-based editing** — drag-to-move, boundary trimming with collision detection, splitting at the playhead, snap-to-grid (beats/bars or timescale), undo/redo
- **Split context providers** — `WaveformPlaylistProvider` (multitrack, Tone.js-backed) and `MediaElementPlaylistProvider` (single-track, `<audio>`-backed with pitch-preserving playback rate)
- **Focused context hooks** — one hook per group of fields that change together (`useIsPlaying`, `useCurrentTime`, `useSelection`, `useAnnotations`, `usePlaybackControls`, `usePlaybackRefs`, `usePlaylistView`, `usePlaylistTimeline`, `usePlaylistMixer`, `useLoop`, `useEditorControls` and more), so a component re-renders only for the group it reads, not on every pointer move, slider step or annotation boundary
- **Audio effects** — 20 Tone.js effects (reverb, delay, modulation, filter, distortion, dynamics, spatial) with runtime parameter control, master and per-track chains, plus WAM 2.0 plugin hosting
- **Recording** — pairs with `@waveform-playlist/recording` for mic input, overdubbing, and live waveform preview; punch-in takes replace overlapped content, and `useRecordingSession({ isRecording, trackId })` (or `setRecordingActive(active, recordingTrackId)` directly) suppresses the end-of-timeline auto-stop and mutes the recorded-over track for the take (its Mute button shows it and is disabled; the track's own mute is not changed, so a mute set during the take stays)
- **Annotations & spectrogram** — optional integration contexts for `@waveform-playlist/annotations` and `@waveform-playlist/spectrogram`. Under either provider, `<WaveformAnnotationBoxes>` (a part of the view; it wires the drag of the box edges itself) and `<AnnotationList>` (the text list, anywhere under the provider) draw the annotations
- **WAV export** — render the full mix (including effects) offline to a downloadable WAV file
- **MediaElement player mode** — a lightweight single-track player with pitch-preserving speed control, for podcast/audiobook-style use cases that don't need multitrack mixing

## Installation

```bash
npm install @waveform-playlist/browser @waveform-playlist/playout @waveform-playlist/core tone @dnd-kit/react
```

`@waveform-playlist/browser` requires these peer dependencies:

| Package | Purpose |
|---------|---------|
| `react` / `react-dom` | ^19.0.0 |
| `styled-components` | ^6.0.0 — CSS-in-JS styling |
| `tone` | ^15.0.0 — Web Audio engine (optional if you supply your own `PlayoutAdapter`) |
| `@dnd-kit/react` | ^0.5.0 — drag-and-drop (includes `@dnd-kit/dom` and `@dnd-kit/abstract`) |
| `@waveform-playlist/playout` | Tone.js playout engine (optional peer, dynamically imported by default) |
| `@waveform-playlist/media-element-playout` | engine for `MediaElementPlaylistProvider` (optional peer) |
| `@waveform-playlist/annotations` / `@waveform-playlist/recording` / `@dawcore/wam` | optional, install only if you use those features |

**Engine-free core:** the package's main entry has no static dependency on `tone` or `@waveform-playlist/playout` — a `MediaElementPlaylistProvider`-only consumer, or one supplying a custom `createAdapter`, never resolves either. Tone-coupled exports (effects hooks, `useExportWav`, `useOutputMeter`, `useMasterAnalyser`) live at the **`@waveform-playlist/browser/tone`** subpath:

```typescript
import { useDynamicEffects, useExportWav } from '@waveform-playlist/browser/tone';
```

## Quick Start

```tsx
import {
  WaveformPlaylistProvider,
  Waveform,
  WaveformViewOptions,
  PlayButton,
  PauseButton,
  StopButton,
  useCreateArrangement,
} from '@waveform-playlist/browser';
import { audioTrack } from '@waveform-playlist/core';

function MyPlaylist() {
  // One arrangement for the life of the component: it owns the tracks and loads their audio
  const arrangement = useCreateArrangement(() => [
    audioTrack({ src: '/audio/vocals.mp3', name: 'Vocals' }),
    audioTrack({ src: '/audio/guitar.mp3', name: 'Guitar' }),
  ]);

  return (
    <WaveformPlaylistProvider arrangement={arrangement} samplesPerPixel={1024}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <PlayButton />
        <PauseButton />
        <StopButton />
      </div>
      <WaveformViewOptions waveHeight={128}>
        <Waveform />
      </WaveformViewOptions>
    </WaveformPlaylistProvider>
  );
}
```

`<WaveformViewOptions>` sets the options that only affect how a view draws (`waveHeight`, `barWidth`, `barGap`, `roundedBars`, `progressBarWidth`, `fillViewport`) for every view below it. They are not provider props. It works under either provider and may sit above the provider, also above several.

Prefer a lightweight single-track player instead? Use `MediaElementPlaylistProvider` with `@waveform-playlist/media-element-playout` — no Tone.js, no AudioBuffer decoding, and pitch-preserving playback rate out of the box.

## Context Hooks

Each provider splits its context into one hook per group of fields that change together, so components only re-render for the data they actually read. The two providers serve what they share through the same hooks, so a component written against the first table works under either; a hook reads the nearest provider.

Under either provider:

| Hook | Exposes | Re-renders on |
|------|---------|---------------|
| `useIsPlaying` | `isPlaying` | play, pause, stop |
| `useCurrentTime` | `currentTime` — where the cursor rests; does not advance during playback | a seek, a pause, a stop and a leftward selection drag |
| `useSelection` | `selectionStart`, `selectionEnd` | every pointer move of a selection drag, so only components that show the selection should call it |
| `useActiveAnnotation` | `activeAnnotationId` | every annotation boundary during playback, so only components that show the active annotation should call it |
| `useAnnotations` | `annotations` | an annotation edit |
| `useAnnotationOptions` | `editable`, `linkEndpoints`, `continuousPlay`: the three annotation options. They start from the provider's `annotationList` prop and follow it | one of the three being toggled |
| `usePlaybackControls` | Actions — `play`, `pause`, `stop`, `seekTo`, `setSelection`, and the annotation, scroll and time-format setters | never |
| `usePlaybackRefs` | `currentTimeRef` (the live position), `visualTimeRef` (the position to draw), `registerFrameCallback()` / `unregisterFrameCallback()` for 60fps-driven UI (playhead, progress bars) | never |
| `usePlaylistView` | What the provider was configured with that a view also reads: `sampleRate`, `mono`, `indefinitePlayback`. The view options are not here: inside a view, `usePlaylistInfo()` from `@waveform-playlist/ui-components` has the resolved `waveHeight`, `barWidth`, `barGap`, `roundedBars` and `progressBarWidth` | a provider prop change |
| `usePlaylistSettings` | `timeFormat`, `isAutomaticScroll` | the user changing either setting |
| `usePlaylistZoom` | `samplesPerPixel`, `canZoomIn`, `canZoomOut` | a zoom |

`WaveformPlaylistProvider` only:

| Hook | Exposes | Re-renders on |
|------|---------|---------------|
| `useArrangement` | The provider's `Arrangement`: change the tracks through it | never |
| `useEditorControls` | Actions — track mute/solo/volume/pan (by track id; each an undo step, `{ gesture }` makes a slider drag one), track order, zoom, loop, undo/redo (on the arrangement, engine or not), `setRecordingActive` (recording-session suppression + the take's mute on the recorded track) | never |
| `useEngineRefs` | `playoutRef` (the engine), `getPlaybackTime()`, `getAudioContextTime()`, `getLookAhead()`, `getOutputLatency()`, `playbackStartTimeRef`, `audioStartPositionRef` | never |
| `usePlaylistTimeline` | `tracks` (loaded clips only, read-only), `peaksDataArray` (with placeholder records for clips still loading), `duration` (loaded audio), `isReady` | every clip operation (a trim once, on release), a zoom (`peaksDataArray` is computed per zoom level), audio or peaks arriving, `isReady` changing |
| `usePlaylistMixer` | `trackStates` (one entry per track in the order of `tracks`, also while a track loads), `masterVolume` | every mute, solo, volume or pan change (each step of a slider drag, an undo or a redo of one); a take starting or ending on a track; tracks added, removed, renamed or reordered |
| `useTrack` | Among the children of `<WaveformTrackControls>` only: the track whose panel is being drawn (id, name, mixer state, `isSelected`, `isRecording`) and actions bound to it (`setMuted`, `setVolume`, `moveUp`, …) | a change of that track's state, position or selection |
| `useTrackReorderPreview` | `trackDragPreview` | every drag-over of a track reorder |
| `useLoop` | `isLoopEnabled`, `loopStart`, `loopEnd` | a loop change |
| `useSelectedTrackId` | `selectedTrackId` | another track being selected |
| `useUndoRedo` | `canUndo`, `canRedo` | after an edit |

`MediaElementPlaylistProvider` only:

| Hook | Exposes | Re-renders on |
|------|---------|---------------|
| `usePlaybackRate` | `playbackRate`, `setPlaybackRate` | the speed changing |
| `useMediaElementTrack` | `duration`, `isReady`, `peaksDataArray` (its clip carries the fades), `playoutRef` (the player) | the track or the zoom level changing, the player becoming ready |

`usePlaylistTimeline` and `usePlaylistMixer` change during an interaction; call them in the smallest component that needs them. `usePlaybackRefs` and `useEngineRefs` never re-render the component that calls them: read a ref's `.current` in a handler, an effect or a frame callback.

The transport buttons (`PlayButton`, `PauseButton`, `StopButton`, `RewindButton`, `FastForwardButton`, `SkipBackwardButton`, `SkipForwardButton`), `AudioPosition`, `TimeFormatSelect`, `SelectionTimeInputs` and `AutomaticScrollCheckbox` work under either provider. `PlaybackRateSelect` works under `MediaElementPlaylistProvider` only.

## Arrangement Hooks

`useCreateArrangement(init?, options?)` makes the `Arrangement` (from `@waveform-playlist/engine`) that owns a multitrack editor's tracks, one per component instance: pass it to `<WaveformPlaylistProvider arrangement>`. `useArrangementTracks(arrangement)` returns its tracks, loading clips included, and re-renders when they change, not on a mix change; `useArrangementSources(arrangement)` returns where each source is (`pending`, `loaded` or `failed`) with `pendingCount`, `failedCount` and `isLoading`. They are in the core entry. See the [hooks reference](https://naomiaro.github.io/waveform-playlist/docs/react/api/hooks#arrangement-hooks) and the [Loading Audio guide](https://naomiaro.github.io/waveform-playlist/docs/react/guides/loading-audio).

## Examples & Documentation

- [naomiaro.github.io/waveform-playlist](https://naomiaro.github.io/waveform-playlist/) — guides, API reference, and live examples
- [Basic Usage guide](https://naomiaro.github.io/waveform-playlist/docs/react/getting-started/basic-usage) — walkthrough of the provider pattern
- [`examples/media-element-player`](https://github.com/naomiaro/waveform-playlist/tree/main/examples/media-element-player) — `MediaElementPlaylistProvider` starter (`pnpm example:media-element`)

## License

MIT
