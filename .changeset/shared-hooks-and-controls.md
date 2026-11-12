---
'@waveform-playlist/browser': major
'@waveform-playlist/spectrogram': patch
---

One set of context hooks and controls for both providers. `WaveformPlaylistProvider` and `MediaElementPlaylistProvider` render the same context objects for what they share, so a control written against the shared hooks works under either.

- Under either provider: `useIsPlaying`, `useCurrentTime`, `useSelection`, `useActiveAnnotation`, `useAnnotations`, `usePlaybackControls`, `usePlaybackRefs`, `usePlaylistView`, `usePlaylistSettings`, `usePlaylistZoom`.
- `WaveformPlaylistProvider` only: `useEditorControls`, `useEngineRefs`, `useAnnotationEditing`, and as before `usePlaylistTimeline`, `usePlaylistMixer`, `useTrackReorderPreview`, `useLoop`, `useSelectedTrackId`, `useUndoRedo`.
- `MediaElementPlaylistProvider` only: `usePlaybackRate`, `useMediaElementTrack`.
- Removed: `usePlaylistControls` (now `usePlaybackControls` and `useEditorControls`), `usePlaylistAnnotations` (now `useAnnotations` and `useAnnotationEditing`), `useMediaElementAnimation`, `useMediaElementState`, `useMediaElementControls`, `useMediaElementData`, and their value types. `usePlaybackRefs()` keeps `currentTimeRef`, `visualTimeRef`, `registerFrameCallback` and `unregisterFrameCallback`; its eight engine fields are on `useEngineRefs()`.
- A hook that the nearest provider does not serve throws and names the provider it needs, also when a provider of the other kind is further out.
- `PlayButton`, `PauseButton`, `StopButton`, `RewindButton`, `FastForwardButton`, `SkipBackwardButton`, `SkipForwardButton`, `ClearAllButton`, `AudioPosition`, `TimeFormatSelect`, `SelectionTimeInputs`, `AutomaticScrollCheckbox`, `ContinuousPlayCheckbox` and `DownloadAnnotationsButton` work under `MediaElementPlaylistProvider`. New: `PlaybackRateSelect`.
- The rewind, fast-forward and skip buttons, and the `0` shortcut, call `seekTo` only. `seekTo` during playback, under `WaveformPlaylistProvider`, now also re-points a play that is waiting for an engine rebuild (before: the cursor moved and playback resumed at the old position).
- `MediaElementPlaylistProvider` has a time format (`usePlaylistSettings().timeFormat`, `setTimeFormat`).
- Under `MediaElementPlaylistProvider` a seek, a stop and a leftward selection drag no longer render the waveform, only the playhead and the progress overlay.

See "One set of hooks and controls for both providers" in the upgrade guide.
