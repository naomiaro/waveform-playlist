---
'@waveform-playlist/browser': major
'@waveform-playlist/ui-components': major
---

One playhead, one progress overlay, one selection highlight and one custom-playhead wrapper for both providers (#688, part 3). The MediaElement copies are removed; none of these parts was a public export.

- `PlayheadProps` (`@waveform-playlist/ui-components`) is the seven props both providers can give: `position`, `color`, `isPlaying`, `currentTimeRef`, `visualTimeRef` (now required, and passed under `MediaElementPlaylistProvider` too, where it is the same ref as `currentTimeRef`), `samplesPerPixel`, `sampleRate`. Removed: `getPlaybackTime`, `getAudioContextTime`, `playbackStartTimeRef`, `audioStartPositionRef` (a playhead for `WaveformPlaylistProvider` that needs one calls `useEngineRefs()`) and `controlsOffset` (always 0). The props are a plain object: a removed name reads `undefined`.
- `PlayheadWithMarker` places itself from `visualTimeRef` only.
- `MediaElementPlaylistProvider`: the resting playhead (default or custom) is hidden while a range is highlighted, as it always was under `WaveformPlaylistProvider`; it is shown during playback and when the selection is collapsed.
- `MediaElementPlaylistProvider`: the progress overlay is as wide as the clip (before: as wide as the peak data, one pixel wider on the example pages).
- `WaveformPlaylistProvider`: two visualizations under one provider each animate their default playhead (before: they shared one frame-callback id and only one moved).
- A selected channel whose theme has no selected colour falls back to the unselected one.
- The `usePlaybackRefs()` value is a plain object again: the eight fields that moved to `useEngineRefs()` in part 2 read `undefined` there (they threw in the unreleased part 2).

See "One playhead and one progress overlay for both providers" in the upgrade guide.
