---
'@waveform-playlist/browser': patch
---

`MediaElementPlaylistProvider`: when the active annotation changes, which happens at every annotation boundary during playback, of the annotation boxes and list rows only the two that stop being active and the two that become active render, and the waveform does not render at all. Before, every box, every row and the whole waveform did.

- `MediaElementPlaylist` no longer reads the annotations or the active annotation; a small inner component does, and renders the boxes through the same memoized box the `WaveformPlaylistProvider` visualization uses.
- `MediaElementAnnotationList` and `MediaElementWaveform` no longer build a new `annotationListConfig` object on every render (it re-rendered every row). An `annotationListConfig` you pass to `MediaElementAnnotationList` yourself should keep its identity between renders for the same reason.
- `PlaylistAnnotationList` and `MediaElementAnnotationList` are now thin wrappers around one shared list component, and both players use one shared boxes component. No behaviour change for `WaveformPlaylistProvider`.
- Fix: dragging an annotation boundary in `MediaElementPlaylist` converted pixels to seconds with 48000 Hz whatever the track's sample rate was, so on a 44100 Hz file the boundary moved about 8% less than the pointer. It now uses the track's rate.

No API change. Measured on the new Media Element Annotations example (15 annotations), development build, per annotation boundary: 220 components and about 14 ms of React render at 4x CPU throttle before, 45 components and about 4.5 ms after. `activeAnnotationId` stays in `useMediaElementState()` and `currentTime` in `useMediaElementAnimation()`: with the above, moving them to contexts of their own would be a breaking change for almost no further gain.
