---
'@waveform-playlist/browser': patch
---

Continuous play no longer restarts the audio when it should not, and now does what it says when switched on mid-playback (#701):

- With continuous play on, starting playback started the audio, then immediately stopped and restarted it at the same position. It is now started once.
- With continuous play on, a change of `duration` during playback (a longer track added, for example) stopped and restarted the audio. It no longer does.
- Switching continuous play on while one annotation was playing rescheduled the audio without an end, but the playhead loop still stopped playback at that annotation's end. Playback now continues past it.

Not checked: whether the two restarts were audible with the Tone adapter; they were observed as adapter calls in tests.
