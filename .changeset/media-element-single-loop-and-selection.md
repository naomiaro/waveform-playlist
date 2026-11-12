---
'@waveform-playlist/browser': patch
---

`MediaElementPlaylistProvider` now runs one animation loop: its playhead and progress overlay are drawn by the provider's loop instead of each running their own `requestAnimationFrame` loop. It also owns the time selection, so each pointer move of a selection drag re-renders the highlighted range and not the waveform (on the media-element examples, 5 components per move; 31 and 45 before).

Visible differences: the selection survives a remount of `MediaElementPlaylist`; two `MediaElementPlaylist` under one provider show the same selection, so a press on one clears the range highlighted in both; a custom `renderPlayhead` is no longer called on every pointer move of a selection drag; automatic scroll positions are whole pixels, as under `WaveformPlaylistProvider`; and when the provider replaces its player during playback (a new track source, or an inline `onReady` / `onError` / `createPlayout` on a parent that re-renders), `isPlaying` becomes `false` instead of staying `true` with nothing playing. When the track's `source` or `waveformData` changes, the cursor goes to 0 and the active annotation is cleared; the same audio in a new player keeps both, and `currentTime` is brought up to the position playback had reached. `seekTo` clamps to the length of the current track, not to the `duration` value, so a seek before the player is ready, or a saved position restored for a longer file, is no longer cut off; the player is moved to that position when it is ready.

No public API changes. The logic the two providers used to duplicate (annotation state, scroll following, the annotation step of the animation loop, view defaults) exists once.
