---
'@waveform-playlist/media-element-playout': minor
---

New event `playrejected` on `MediaElementTrack` and `MediaElementPlayout` (`playout.on('playrejected', (err) => …)`): a `play()` the browser did not start, because it refused it (no user gesture), the source is not playable, or resuming the `AudioContext` (or the start that follows it) failed. It is not emitted while a `resume()` stays pending (#783). `playout.isPlaying` is `false` afterwards. A play that was only interrupted by a `pause()` or a newer `play()` (an `AbortError`) is not reported and no longer logs a warning.

A `play()` that is waiting for a suspended `AudioContext` to resume is now cancelled by `pause()`, `stop()`, `load()`, `dispose()` and a newer `play()`. Before, a Stop pressed during that wait was followed by sound when the context resumed.
