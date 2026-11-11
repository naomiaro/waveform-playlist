---
'@waveform-playlist/ui-components': patch
'@waveform-playlist/browser': patch
'@waveform-playlist/annotations': patch
'@waveform-playlist/spectrogram': patch
---

Small rendering cleanups (#701). None of these was profiled before and after. Each has a test of the mechanism except the last two, which have none.

- `ClipBoundary` (ui-components): hover styling comes from the CSS `:hover` rule alone. A duplicate `isHovered` state re-rendered the handle on every mouse enter and leave.
- `FadeOverlay` (ui-components): the SVG path is memoised on width and curve type and its coordinates are rounded to two decimals, instead of rebuilding up to 101 unrounded points on every render.
- Timeline width with `fillViewport` / `indefinitePlayback` (browser): the scroll container's width is tracked with a `ResizeObserver` instead of being read from the DOM while rendering. The timeline now fills the container on the first paint and follows a container resize; it used to be sized from a width of 0 on the first render and only caught up on a later, unrelated render.
- `MediaElementPlaylistProvider` progress overlay (browser): animated with `transform: scaleX()` instead of `width`, like the multi-track provider, and its geometry is set as inline styles so a zoom step no longer generates new CSS classes.
- Active-annotation lookup during playback (browser, both providers): the per-frame scans over all annotations are replaced by a cached lookup that returns the same annotation as before. The cache is keyed on the annotations array, so annotations must be replaced with a new array to change them (mutating the array or an annotation in place is not picked up during playback). It only matters with thousands of annotations.
- Lazy initial state for the `Map`s in `useAudioTracks`, `useTrackDynamicEffects` (browser) and `SpectrogramProvider` (spectrogram).
- `AnnotationText` (annotations): removed an effect and a scroll listener whose bodies were empty.
