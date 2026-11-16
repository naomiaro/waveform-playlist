---
'@waveform-playlist/browser': patch
---

`WaveformPlaylistProvider` always disposes its engine and adapter on unmount. After a clip move, trim or split, an added track, a track that got its audio or an emptied timeline, an unmount used to dispose nothing, so the adapter was never disposed: with the default Tone engine its transport kept running and its audio nodes stayed connected. A failed rebuild no longer disposes the previous adapter a second time.

Inside an `<Activity>`, hiding the provider now always disposes the engine, as it already did right after a full build: playback stops while hidden and resumes from the same position when it is shown again (it used to keep playing while hidden after an edit).
