---
'@waveform-playlist/engine': patch
---

Internal: `PlaylistEngine`'s track state, undo history and transactions move into an `Arrangement` object that the engine delegates to. No behaviour change, with one exception in call order: the four track mixer setters now increase `mixerVersion` before they call the adapter, not after, which only an adapter that reads the engine's state (or throws) inside `setTrackVolume` / `setTrackMute` / `setTrackSolo` / `setTrackPan` can observe.
