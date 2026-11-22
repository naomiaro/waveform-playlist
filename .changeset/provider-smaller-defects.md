---
'@waveform-playlist/browser': patch
---

Three smaller provider defects are fixed.

A playback that never starts no longer leaves the transport showing playback that is not running. When `engine.play` throws during a restart — a seek or an annotation click while playing — the engine and the animation loop were stopped, but `isPlaying` stayed `true`, because the `engine.stop()` that precedes the restart is suppressed so that the mirror does not clear the flag before the seek that follows it. The catch now sets `isPlaying` back to `false`.

`seekTo(NaN)` and `setPlaybackRate(NaN)` are ignored under the MediaElement provider. NaN is not a position and not a speed: it went into the time refs, into the state and into the player, and nothing came back. `seekTo(Infinity)` is still the end of the audio (what Fast Forward asks for), and an infinite speed is still clamped to the upper bound.

`setAnnotations` with a function now reads the last value it handed to `onAnnotationsChange`, not the committed array. The type promises React's `setState` queueing, so two functional updates in one tick must both be applied; before, both read the committed array and the first was dropped.
