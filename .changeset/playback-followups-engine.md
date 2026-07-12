---
'@waveform-playlist/engine': patch
---

PlayoutAdapter gains optional onPlaybackEnded(callback|null); PlaylistEngine subscribes and stops (microtask-deferred) when bounded playback completes on its own (#608)
