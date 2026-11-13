---
'@waveform-playlist/browser': major
---

During playback, a press on the waveform no longer moves playback at once: nothing is committed until the mouse button is released, under both providers. With automatic scroll off, a drag made while playing is highlighted as it is drawn and, on release, becomes the selection and is played from its start to its end; a click moves playback to where the press landed. With automatic scroll on no range can be drawn during playback (the waveform moves under the pointer): a press and its release are one seek to the press. Before, the multitrack view moved playback on the press and again on the release, and a drag made while playing selected nothing in either view.
