---
'@waveform-playlist/engine': minor
---

A listener of `arrangement.subscribe()` is told the kind of change: it is called with `{ type }`, where `type` is one of `'set'`, `'add'`, `'remove'`, `'update'`, `'reorder'`, `'restore'`, `'restoreMix'`, `'load'`, `'mixer'`, `'recording'`, `'recompute'` and `'history'` (the new types `ArrangementChangeType` and `ArrangementChangeInfo`). A listener that takes no argument works as before. With it a host can keep the engine's rule for the selected track (cleared when its track is removed, taken away by an undo, a redo or an abort, or given a new id, and kept across `setTracks`) for a copy of its own, as `WaveformPlaylistProvider` now does (#826).
