---
'@waveform-playlist/browser': major
'@waveform-playlist/recording': patch
'@waveform-playlist/core': patch
---

The view is composed from parts. Each thing the view draws is an exported component that is drawn because it is rendered inside a root:

- Roots: `WaveformRoot` (under `WaveformPlaylistProvider`), `MediaElementWaveformRoot` (under `MediaElementPlaylistProvider`).
- Parts: `WaveformTimescale` (`renderTick`), `WaveformLoopRegion`, `WaveformTrackControls` (`width`, `renderTrackControls`, `onRemoveTrack`, `trackReordering`), `WaveformTracks` (`gainScaled`) with the children `WaveformClipHeaders`, `WaveformFades` and `WaveformRecordingPreview` (`recordingState`), `WaveformAnnotationBoxes`, `MediaElementAnnotationBoxes`, `WaveformSelection`, `WaveformPlayhead` (`renderPlayhead`).
- Ready-made: `<Waveform />` (timescale, loop region, 200 px track controls, tracks, annotation boxes, selection, playhead, annotation list), the new `<WaveformEditor />` (the same with clip headers and fades) and `<MediaElementWaveform />`. They take `className` and their annotation options only.
- New hook `useRecordingSession({ isRecording, trackId })`, and the type `WaveformRecordingState`.

Removed:

- From `<Waveform>`: `showClipHeaders`, `showFades`, `gainScaledWaveforms`, `trackReordering`, `onRemoveTrack`, `recordingState`, `renderTrackControls`, `renderTick`, `renderPlayhead`. From `<MediaElementWaveform>`: `renderPlayhead`, `showFades`. Each is an option of a part, or a part.
- From both providers: `timescale` and `controls`. The timescale is there when `<WaveformTimescale />` is rendered; the controls column when `<WaveformTrackControls />` is, as wide as its `width`.
- From the value of `usePlaylistView()`: `timeScaleHeight` and `controls`.
- `PlaylistVisualization` and `MediaElementPlaylist`, with their props types: compose the parts inside the root.

Behaviour:

- `<Waveform />` always has a timescale and a 200 px controls column, and `<MediaElementWaveform />` a timescale; a page that had none composes the parts it wants.
- The view no longer tells the provider that a take is being recorded. Without `useRecordingSession` the armed track is not muted during a take and playback does not run past the end of the audio.
- A part that is not where it can work (wrapped in another component, a per-clip part outside `<WaveformTracks>`, track controls under the MediaElement root) warns once in the console in development.
- `MediaElementPlaylistProvider` compares the track's `fadeIn` / `fadeOut` by value. A fade object written inline used to dispose and re-create the player on every render of the provider's parent.

The upgrade guide has the find-and-replace for each removed name.
