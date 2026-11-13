---
'@waveform-playlist/browser': major
---

During playback nothing is committed until the mouse button is released, under both providers (the multitrack view used to move playback on the press; the MediaElement view already waited for the release). With automatic scroll off, a drag made while playing is highlighted as it is drawn and, on release, becomes the selection and is played from its start to its end (under `WaveformPlaylistProvider` with looping on: open-ended from its start); a click moves playback to where the press landed. With automatic scroll on no range can be drawn during playback (the waveform moves under the pointer): a press and its release are one seek to the press. Before, the multitrack view moved playback on the press and again on the release, and a drag made while playing selected nothing in either view.

`useEngineRefs()`: `playbackStartTimeRef` and `audioStartPositionRef` are now written by the restart `setSelection` does during playback, not only by `play()`. A readout or playhead computed from them stayed on the replaced play after a selection made during playback.
