---
'@waveform-playlist/browser': major
'@waveform-playlist/ui-components': major
'@waveform-playlist/annotations': major
'@waveform-playlist/spectrogram': major
---

The public API of the React packages follows the standing rules (#828): a boolean prop defaults to false, a prop nothing reads is removed, a provider's own hooks are not exported, and each option has one source.

- ui-components: `SegmentedVUMeter`'s `showScale` (default true) is replaced by `hideScale` (default false); the scale is still drawn by default.
- annotations: `AnnotationBox`'s `editable` defaults to `false` (it was `true`). The boxes browser draws pass it from the provider's `editable` option and are unchanged.
- browser: `useZoomControls`, `useMasterVolume`, `ZoomControls` and `MasterVolumeControls` are removed from the entry. Use `usePlaylistZoom()`, `usePlaylistMixer().masterVolume` and `useEditorControls()` (`zoomIn`, `zoomOut`, `setMasterVolume`).
- ui-components: removed because nothing read them: `Playlist`'s required `theme` prop, `StyledPlaylist`, `LoopRegion` and `LoopRegionProps` (`TimescaleLoopRegion` stays), `trackIndex` / `clipIndex` of `ClipHeader` and `ClipBoundary` (`Clip` keeps them), `Clip`'s `isOverlay`, `Track`'s `offset`, `SpectrogramChannel`'s `samplesPerPixel`, `SmartChannel`'s `samplesPerPixel` (the `PlaylistInfoContext` value is used) and `TrackMenuItem.label`. annotations: `AnnotationBoxesWrapper`'s `offset`.
- browser: `useMediaElementTrack()` no longer has `fadeIn` / `fadeOut`; the one clip in its `peaksDataArray` carries them.
- browser: `useClipDragHandlers({ snapSamplePosition? })` and `useClipSplitting()` read the zoom level from the provider; their `samplesPerPixel` option is removed (`UseClipSplittingOptions` with it). A leftover `samplesPerPixel` is ignored in plain JavaScript.
- browser: `MediaElementPlaylistProvider` follows its `samplesPerPixel` prop: a new value redraws the waveform at it, on the same player. It read the prop once, at mount. `automaticScroll` (both providers) and `WaveformPlaylistProvider`'s `samplesPerPixel` stay initial values, now documented as such.
- browser: `AnnotationIntegrationProvider` and `SpectrogramIntegrationProvider` are removed; render `<AnnotationIntegrationContext value>` and `<SpectrogramIntegrationContext value>`, which are exported instead.
- spectrogram: `SpectrogramMenuItems` is renamed `spectrogramMenuItems` (a function that returns menu items, not a component), and `SpectrogramMenuItemsProps` is `SpectrogramMenuItemsOptions`.
- browser exports the types `WaveformPlaylistProviderProps`, `MediaElementPlaylistProviderProps`, `UseClipSplittingResult`, `UseKeyboardShortcutsOptions` and `DragSensorOptions`; ui-components exports `CloseButtonProps`.

The upgrade guide has an entry for each change.
