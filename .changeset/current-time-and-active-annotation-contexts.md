---
'@waveform-playlist/browser': major
---

`currentTime` moves from `usePlaybackAnimation()` to a new `useCurrentTime()` hook, and `activeAnnotationId` moves from `usePlaylistState()` to a new `useActiveAnnotation()` hook. Each has its own context.

`currentTime` is where the cursor rests: it changes on a seek, a pause, a stop and a selection whose start moves (so on every pointer move of a selection drag to the left), and does not advance during playback. While it shared a context with `isPlaying` and the timing refs, every `usePlaybackAnimation()` consumer followed it: the transport buttons, the whole `PlaylistVisualization` shell, and any app component that read only `isPlaying` or `currentTimeRef`. `activeAnnotationId` changes at every annotation boundary during playback, and every `usePlaylistState()` consumer followed that.

Breaking: `usePlaybackAnimation()` no longer returns `currentTime`; read it from `useCurrentTime()`. `usePlaylistState()` no longer returns `activeAnnotationId`; read it from `useActiveAnnotation()`. A component that showed the stopped position from `currentTimeRef` and relied on `usePlaybackAnimation()` to re-render it on a seek must now call `useCurrentTime()`. `setCurrentTime`, `seekTo` and `setActiveAnnotationId` stay on `usePlaylistControls()`. `MediaElementPlaylistProvider` and its hooks are unchanged.

Measured on the annotations example (15 annotations), development build, 4x CPU throttle, fiber-walk probe. Per pointer move of a leftward selection drag: 370 components and 21 to 24 ms of React render before, 21 components and 1.8 ms after (the example now reads `currentTimeRef` in its button handler, which it could not usefully do before). On the multi-clip example: 54 components and 3.5 ms before, 37 and 2.3 ms after. Per annotation boundary during playback: 369 components and 23 to 27 ms before, 48 components and 5.3 to 6.8 ms after. The context split alone gave 265 components; the rest comes from the annotation boxes under the tracks now being memoized per box, so only the box that stops being active and the one that becomes active render.
