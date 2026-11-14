---
'@waveform-playlist/browser': patch
---

`WaveformPlaylistProvider` disposes its engine and adapter on unmount whatever the last `tracks` change was. After a clip move, trim or split, an appended track, a placeholder that got its audio, an emptied timeline or a deferred rebuild, an unmount used to dispose nothing: the AudioContext stayed open and, with the default Tone engine, the transport kept playing. A failed rebuild no longer disposes the previous adapter a second time.
