---
'@waveform-playlist/browser': major
'@waveform-playlist/ui-components': major
'@waveform-playlist/spectrogram': major
---

`usePlaylistData()`, `usePlaylistState()`, `usePlaybackAnimation()` and `usePlaylistDataOptional()` are removed. Each is replaced by hooks that return one group of fields that change together, so a component re-renders only for the group it reads: `usePlaylistView()` (sample rate, sizes, bar style, `mono`, `indefinitePlayback`, `fillViewport`), `usePlaylistSettings()` (`timeFormat`, `isAutomaticScroll`), `usePlaylistZoom()`, `usePlaylistTimeline()` (`tracks`, `peaksDataArray`, `duration`, `isReady`), `usePlaylistMixer()` (`trackStates`, `masterVolume`), `useTrackReorderPreview()`, `useAnnotations()`, `useLoop()`, `useSelectedTrackId()`, `useUndoRedo()`, `useIsPlaying()`, `usePlaybackRefs()` (the time refs and frame-callback functions; this value never changes) and `useEngineRefs()` (the engine's refs and clock functions, with `playoutRef`). The upgrade guide has a field-to-hook table. The value type of every context hook is now exported (`PlaylistViewContextValue` and the rest, including those of the unchanged hooks), with `ClipPeaks`, `TrackClipPeaks` and `TrackDragPreview`. A component that reads `sampleRate` no longer renders on every step of a volume slider, and one that reads a ref no longer renders on play and stop.

`<Waveform>` no longer re-renders on loop, track-selection, undo or annotation changes, and the visualization no longer re-renders on a mixer change (the track controls column does).

ui-components: `PlaylistInfoContext` no longer has `duration`; `<SmartScale>` takes the timeline length as a required `durationMs` prop. Every channel and track reads that context, and the length changes on each pointer move of a trim at the end of the timeline.

spectrogram: `SpectrogramProvider` reads the new hooks, so it needs the new `@waveform-playlist/browser` major.
