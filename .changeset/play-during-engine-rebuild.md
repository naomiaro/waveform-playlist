---
'@waveform-playlist/browser': patch
---

Fix `WaveformPlaylistProvider` getting stuck in "playing" with no audio when Play is pressed around an engine rebuild (#675).

When `tracks` changes in a way that rebuilds the engine (for example while tracks are still streaming in), the old engine is disposed and the new one is created asynchronously. A Play in that window ran against the disposed engine: the UI switched to playing, nothing was scheduled, and the time display stayed at zero until Stop was pressed. The same happened when a play started on the old engine just before it was disposed.

Now a Play during a rebuild is queued and starts as soon as the new engine is ready, playback that was running carries over to the new engine (keeping its end time for selection playback), `isPlaying` only becomes true once an engine has actually started, and `stop()` / `pause()` cancel a queued play.
