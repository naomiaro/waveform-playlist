---
'@waveform-playlist/browser': patch
---

`WaveformPlaylistProvider` disposes its engine and adapter on unmount whatever the last `tracks` change was. After a clip move, trim or split, an appended track, a placeholder that got its audio, an emptied timeline or a deferred rebuild, an unmount used to dispose nothing, so the adapter was never disposed: with the default Tone engine its transport kept running and its audio nodes stayed connected. A failed rebuild no longer disposes the previous adapter a second time.

Inside an `<Activity>`, hiding the provider now always disposes the engine, as it already did right after a full build: playback stops while hidden and resumes from the same position when it is shown again (it used to keep playing while hidden after an edit). While `deferEngineRebuild` is set and no engine exists (it is disposed when the flag turns true after a load, or by a hide), the provider reports not ready until the deferral ends; it used to stay ready with nothing for Play to start.
