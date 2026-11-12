---
'@waveform-playlist/browser': major
'@waveform-playlist/spectrogram': patch
---

One set of context hooks and controls for both providers. `WaveformPlaylistProvider` and `MediaElementPlaylistProvider` render the same context objects for what they share, so a control written against the shared hooks works under either.

- Under either provider: `useIsPlaying`, `useCurrentTime`, `useSelection`, `useActiveAnnotation`, `useAnnotations`, `usePlaybackControls`, `usePlaybackRefs`, `usePlaylistView`, `usePlaylistSettings`, `usePlaylistZoom`.
- `WaveformPlaylistProvider` only: `useEditorControls`, `useEngineRefs`, `useAnnotationEditing`, and as before `usePlaylistTimeline`, `usePlaylistMixer`, `useTrackReorderPreview`, `useLoop`, `useSelectedTrackId`, `useUndoRedo`.
- `MediaElementPlaylistProvider` only: `usePlaybackRate`, `useMediaElementTrack`.
- Removed (six hooks): `usePlaylistControls` (now `usePlaybackControls` and `useEditorControls`), `usePlaylistAnnotations` (now `useAnnotations` and `useAnnotationEditing`), `useMediaElementAnimation`, `useMediaElementState`, `useMediaElementControls`, `useMediaElementData`, and their value types.
- `usePlaybackRefs()` keeps its name, with `currentTimeRef`, `visualTimeRef`, `registerFrameCallback` and `unregisterFrameCallback`; its eight engine fields are on `useEngineRefs()`. Reading one of the eight from the `usePlaybackRefs()` value throws at that read ("playoutRef is no longer on usePlaybackRefs(): read it from useEngineRefs() (WaveformPlaylistProvider only)"), so a leftover destructuring in plain JavaScript fails on the first render instead of handing out `undefined`.
- A hook that the nearest provider does not serve throws and names the provider it needs, also when a provider of the kind it needs is further out.
- `PlayButton`, `PauseButton`, `StopButton`, `RewindButton`, `FastForwardButton`, `SkipBackwardButton`, `SkipForwardButton`, `ClearAllButton`, `AudioPosition`, `TimeFormatSelect`, `SelectionTimeInputs`, `AutomaticScrollCheckbox`, `ContinuousPlayCheckbox` and `DownloadAnnotationsButton` work under `MediaElementPlaylistProvider`. New: `PlaybackRateSelect`.
- `KeyboardShortcuts` and `usePlaybackShortcuts()` throw under `MediaElementPlaylistProvider`, as before this change: the hook listens on the window, and keyboard behaviour for the single-track player is not decided (#723, #730). `useKeyboardShortcuts` (no context) and `useAnnotationKeyboardControls()` can be called there; without `samplesPerPixel` / `sampleRate` options the latter now reads them from the provider, so with a `scrollContainerRef` it scrolls to the active annotation (before: only with both options passed).
- The rewind, fast-forward and skip buttons, and the `0` shortcut, call `seekTo` only. `seekTo` during playback, under `WaveformPlaylistProvider`, now also re-points a play that is waiting for an engine rebuild (before: the cursor moved and playback resumed at the old position); the re-pointed play is open-ended.
- `seekTo` under `WaveformPlaylistProvider`: with `indefinitePlayback`, or during a recording session (while `setRecordingActive(true)` is in effect), a finite time past the end of the audio is kept (before: always clamped to the length of the timeline). `seekTo(Infinity)` still means the end of the audio, and the result is never below 0; otherwise it clamps to the audio as before. Skip Backward from past the end lands where it did before this change (the button used `setCurrentTime`, which does not clamp).
- `MediaElementPlaylistProvider`: `setSelection` orders its two times and clamps both to 0…the length of the audio (before: stored as given), because `SelectionTimeInputs` accepts typed times.
- `MediaElementPlaylistProvider`: a player that replaces another takes the speed the user chose with `setPlaybackRate` / `PlaybackRateSelect` (before: every new player ran at the `playbackRate` prop's speed while the state kept the user's). A `playbackRate` prop that changes after mount now also sets the state, and replaces an earlier choice of the user until they choose again.
- `MediaElementPlaylistProvider` has a time format (`usePlaylistSettings().timeFormat`, `setTimeFormat`).
- Under `MediaElementPlaylistProvider` a `seekTo`, a `stop()` after a pause and a leftward selection drag no longer render the `MediaElementPlaylist` shell (the waveform). The playhead, the progress overlay and the controls that show the cursor or the selection do render.

See "One set of hooks and controls for both providers" in the upgrade guide.
