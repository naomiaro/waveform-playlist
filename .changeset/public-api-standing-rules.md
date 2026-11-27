---
'@waveform-playlist/browser': major
'@waveform-playlist/ui-components': major
'@waveform-playlist/annotations': major
'@waveform-playlist/spectrogram': major
---

The public API of the React packages follows the standing rules (#828): a boolean prop defaults to false, props and components the packages did not use are removed, a provider's own hooks are not exported, and each option has one source.

- ui-components: `SegmentedVUMeter`'s `showScale` (default true) is replaced by `hideScale` (default false); the scale is still drawn by default.
- annotations: `AnnotationBox`'s `editable` defaults to `false` (it was `true`). The boxes browser draws pass it from the provider's `editable` option and are unchanged.
- browser: `useZoomControls`, `useMasterVolume`, `ZoomControls` and `MasterVolumeControls` are removed from the entry. Use `usePlaylistZoom()`, `usePlaylistMixer().masterVolume` and `useEditorControls()` (`zoomIn`, `zoomOut`, `setMasterVolume`).
- ui-components: removed because the packages did not use them: `Playlist`'s required `theme` prop, `StyledPlaylist`, `LoopRegion` and `LoopRegionProps` (`TimescaleLoopRegion` stays), `trackIndex` / `clipIndex` of `ClipHeader` and `ClipBoundary` (`Clip` keeps them), `Clip`'s `isOverlay` (a leftover one in plain JavaScript now draws a real, draggable clip), `Track`'s `offset` (a padding that moved no clip; the row element loses its inline `padding-left: 0px`), `SpectrogramChannel`'s `samplesPerPixel`, `SmartChannel`'s `samplesPerPixel` (the `PlaylistInfoContext` value is used) and `TrackMenuItem.label`. annotations: `AnnotationBoxesWrapper`'s `offset` (a padding that moved no annotation box).
- browser: `useMediaElementTrack()` no longer has `fadeIn` / `fadeOut`; the one clip in its `peaksDataArray` carries them.
- browser: `useClipDragHandlers({ snapSamplePosition? })` and `useClipSplitting()` read the zoom level from the provider; their `samplesPerPixel` option is removed. In plain JavaScript a leftover `samplesPerPixel` is ignored: the provider's zoom level is used, which is what the docs said to pass. `useClipSplitting()` outside a provider throws the `useArrangement` error, as before.
- browser: `MediaElementPlaylistProvider` follows its `samplesPerPixel` prop: a new value redraws the waveform at it, on the same player. It read the prop once, at mount. A value finer than the waveform data is drawn at the data's own resolution (it left the row empty), and `usePlaylistZoom().samplesPerPixel` reports that value.
- browser: a zoom change in either provider keeps the time under a hovering mouse or pen where it is when the pointer is over the waveform, and the time at the centre otherwise (the zoom buttons keep the centre). Before, `WaveformPlaylistProvider` kept the centre, but after a zoom out from a scrolled view it read the scroll position the browser had already clamped and moved the view (by 12% of the timeline on the multi-clip example); the MediaElement player kept the scroll in pixels. The scroll is now set before the new zoom is painted, and the animation loop reads the committed zoom level.
- browser: `automaticScroll` (both providers) and `WaveformPlaylistProvider`'s `samplesPerPixel` stay initial values, now documented as such.
- browser: `AnnotationIntegrationProvider` and `SpectrogramIntegrationProvider` are removed; render `<AnnotationIntegrationContext value>` and `<SpectrogramIntegrationContext value>`, which are exported instead.
- spectrogram: `SpectrogramMenuItems` is renamed `spectrogramMenuItems` (a function that returns menu items, not a component), and `SpectrogramMenuItemsProps` is `SpectrogramMenuItemsOptions`.
- browser exports the types `WaveformPlaylistProviderProps`, `MediaElementPlaylistProviderProps`, `UseClipSplittingResult`, `UseKeyboardShortcutsOptions` and `DragSensorOptions`; ui-components exports `CloseButtonProps`.

The upgrade guide has an entry for each change.
