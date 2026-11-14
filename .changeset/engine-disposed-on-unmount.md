---
'@waveform-playlist/browser': patch
---

`WaveformPlaylistProvider` disposes its engine and adapter on unmount whatever the last `tracks` change was. After a clip move, trim or split, an appended track, a placeholder that got its audio, an emptied timeline or a deferred rebuild, an unmount used to dispose nothing, so the adapter (and its AudioContext and transport) stayed alive. A failed rebuild no longer disposes the previous adapter a second time.

Inside an `<Activity>`, hiding the provider now always disposes the engine, as it already did right after a full build: playback stops while hidden and resumes from the same position when it is shown again (it used to keep playing while hidden after an edit). Revealed while `deferEngineRebuild` is set, the provider reports not ready until the deferral ends.
