---
'@waveform-playlist/media-element-playout': minor
---

New event `playrejected` on `MediaElementTrack` and `MediaElementPlayout` (`playout.on('playrejected', (err) => …)`): a `play()` the browser did not start, because it refused it (no user gesture), the source is not playable, or the `AudioContext` could not be resumed. `playout.isPlaying` is `false` afterwards. A play that was only interrupted by a `pause()` or a newer `play()` (an `AbortError`) is not reported and no longer logs a warning.
