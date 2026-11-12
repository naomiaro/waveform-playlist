---
'@waveform-playlist/browser': patch
---

`MediaElementPlaylistProvider` now runs one animation loop: its playhead and progress overlay are drawn by the provider's loop instead of each running their own `requestAnimationFrame` loop. It also owns the time selection, so a selection drag re-renders only the highlighted range and not the waveform (on the media-element examples, 31 and 45 components per pointer move before).

Visible differences: the selection survives a remount of `MediaElementPlaylist`; two `MediaElementPlaylist` under one provider show the same selection; a custom `renderPlayhead` is no longer called on every pointer move of a selection drag; automatic scroll positions are whole pixels, as under `WaveformPlaylistProvider`.

No public API changes. The logic the two providers used to duplicate (annotation state, scroll following, the annotation step of the animation loop, view defaults) exists once.
