# @waveform-playlist/browser

React components, hooks, and context providers for building a multitrack Web Audio editor and player — canvas waveform rendering, clip-based editing, and playback controls on top of Tone.js or a native `HTMLAudioElement`.

## Features

- **Multitrack editor** — `<Waveform />` renders canvas waveforms, per-track controls (mute/solo/volume/pan), a time ruler, and a playhead for any number of tracks
- **Clip-based editing** — drag-to-move, boundary trimming with collision detection, splitting at the playhead, snap-to-grid (beats/bars or timescale), undo/redo
- **Split context providers** — `WaveformPlaylistProvider` (multitrack, Tone.js-backed) and `MediaElementPlaylistProvider` (single-track, `<audio>`-backed with pitch-preserving playback rate)
- **Focused context hooks** — one hook per group of fields that change together (`usePlaylistView`, `usePlaylistSettings`, `usePlaylistZoom`, `usePlaylistTimeline`, `usePlaylistMixer`, `usePlaylistAnnotations`, `useLoop`, `useSelection`, `useCurrentTime`, `useIsPlaying`, `usePlaybackRefs`, `usePlaylistControls` and more), so a component re-renders only for the group it reads, not on every pointer move, slider step or annotation boundary
- **Audio effects** — 20 Tone.js effects (reverb, delay, modulation, filter, distortion, dynamics, spatial) with runtime parameter control, master and per-track chains, plus WAM 2.0 plugin hosting
- **Recording** — pairs with `@waveform-playlist/recording` for mic input, overdubbing, and live waveform preview; punch-in takes replace overlapped content, and `setRecordingActive(active, armedTrackId)` suppresses the end-of-timeline auto-stop and transiently mutes the recorded-over track for the session
- **Annotations & spectrogram** — optional integration contexts for `@waveform-playlist/annotations` and `@waveform-playlist/spectrogram`
- **WAV export** — render the full mix (including effects) offline to a downloadable WAV file
- **MediaElement player mode** — a lightweight single-track player with pitch-preserving speed control, for podcast/audiobook-style use cases that don't need multitrack mixing

## Installation

```bash
npm install @waveform-playlist/browser tone @dnd-kit/react
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

**Engine-free core:** the package's main entry has no static dependency on `tone` or `@waveform-playlist/playout` — a `MediaElementPlaylistProvider`-only consumer, or one supplying a custom `createAdapter`, never resolves either. Tone-coupled exports (`useAudioTracks`, `useDynamicTracks`, effects hooks, `useExportWav`, `useOutputMeter`, `useMasterAnalyser`) live at the **`@waveform-playlist/browser/tone`** subpath:

```typescript
import { useAudioTracks, useDynamicEffects, useExportWav } from '@waveform-playlist/browser/tone';
```

## Quick Start

```tsx
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
} from '@waveform-playlist/browser';
import { useAudioTracks } from '@waveform-playlist/browser/tone';

function MyPlaylist() {
  const { tracks, loading, error } = useAudioTracks([
    { src: '/audio/vocals.mp3', name: 'Vocals' },
    { src: '/audio/guitar.mp3', name: 'Guitar' },
  ]);

  if (loading) return <div>Loading audio...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      samplesPerPixel={1024}
      waveHeight={128}
      timescale
      controls={{ show: true, width: 200 }}
    >
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <PlayButton />
        <PauseButton />
        <StopButton />
      </div>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

Prefer a lightweight single-track player instead? Use `MediaElementPlaylistProvider` with `@waveform-playlist/media-element-playout` — no Tone.js, no AudioBuffer decoding, and pitch-preserving playback rate out of the box.

## Context Hooks

`WaveformPlaylistProvider` splits its context into one hook per group of fields that change together, so components only re-render for the data they actually read:

| Hook | Exposes | Re-renders on |
|------|---------|---------------|
| `usePlaylistView` | What the provider was configured with: `sampleRate`, `waveHeight`, `timeScaleHeight`, `controls`, `barWidth`, `barGap`, `roundedBars`, `progressBarWidth`, `mono`, `indefinitePlayback`, `fillViewport` | a provider prop change |
| `usePlaylistSettings` | `timeFormat`, `isAutomaticScroll` | the user changing either setting |
| `usePlaylistZoom` | `samplesPerPixel`, `canZoomIn`, `canZoomOut` | a zoom |
| `usePlaylistTimeline` | `tracks`, `peaksDataArray`, `duration`, `isReady`, `onTracksChange` | every clip operation, every pointer move of a trim, a zoom (`peaksDataArray` is computed per zoom level), loading finishing, peaks arriving |
| `usePlaylistMixer` | `trackStates`, `masterVolume` | every mute, solo, volume or pan change (each step of a slider drag); tracks added, removed or reordered |
| `useTrackReorderPreview` | `trackDragPreview`, `trackReorderEpoch` | every drag-over of a track reorder |
| `usePlaylistAnnotations` | `annotations`, `annotationsEditable`, `linkEndpoints`, `continuousPlay` | an annotation edit, an annotation settings toggle |
| `useLoop` | `isLoopEnabled`, `loopStart`, `loopEnd` | a loop change |
| `useSelectedTrackId` | `selectedTrackId` | another track being selected |
| `useUndoRedo` | `canUndo`, `canRedo` | after an edit |
| `useIsPlaying` | `isPlaying` | play, pause, stop |
| `usePlaybackRefs` | Animation refs (`currentTimeRef` for the live position, `visualTimeRef`), `getPlaybackTime()`, `registerFrameCallback()` for 60fps-driven UI (playhead, progress bars), `playoutRef` (the engine), `isDraggingRef` | never |
| `useSelection` | `selectionStart`, `selectionEnd` | every pointer move of a selection drag, so only components that show the selection should call it |
| `useCurrentTime` | `currentTime` — where the cursor rests; does not advance during playback | a seek, a pause, a stop and a leftward selection drag |
| `useActiveAnnotation` | `activeAnnotationId` | every annotation boundary during playback, so only components that show the active annotation should call it |
| `usePlaylistControls` | Actions — `play`, `pause`, `stop`, `seekTo`, track mute/solo/volume/pan, zoom, undo/redo, `setRecordingActive` (recording-session suppression + armed-track mute) | never |

`usePlaylistTimeline` and `usePlaylistMixer` change during an interaction; call them in the smallest component that needs them. `usePlaybackRefs` never re-renders the component that calls it: read a ref's `.current` in a handler, an effect or a frame callback.

`MediaElementPlaylistProvider` has `useMediaElementAnimation`, `useMediaElementState`, `useMediaElementControls`, `useMediaElementData`.

## Examples & Documentation

- [naomiaro.github.io/waveform-playlist](https://naomiaro.github.io/waveform-playlist/) — guides, API reference, and live examples
- [Basic Usage guide](https://naomiaro.github.io/waveform-playlist/docs/react/getting-started/basic-usage) — walkthrough of the provider pattern
- [`examples/media-element-player`](https://github.com/naomiaro/waveform-playlist/tree/main/examples/media-element-player) — `MediaElementPlaylistProvider` starter (`pnpm example:media-element`)

## License

MIT
