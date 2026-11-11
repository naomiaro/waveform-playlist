---
'@waveform-playlist/browser': patch
---

Continuous play no longer restarts the audio when it should not, does what it says when switched on mid-playback, and no longer interferes with selection playback (#701):

- With continuous play on, starting playback started the audio, then immediately stopped and restarted it at the same position. It is now started once.
- With continuous play on, a change of `duration` during playback (a longer track added, for example) stopped and restarted the audio. It no longer does.
- Switching continuous play on while one annotation was playing rescheduled the audio without an end, but the playhead loop still stopped playback at that annotation's end. Playback now continues past it.
- Playing the selection is no longer affected by continuous play: the selection plays from its start to its end whichever way the toggle is set, and switching the toggle midway changes nothing. Before, with continuous play off, a selection that crossed an annotation boundary was cut short at that boundary. An annotation that is clicked still follows the toggle, also while a selection is highlighted elsewhere.
- Changing the selection during playback replaces whatever bounded play was running (a selection or a single annotation). A new highlighted range is played from its start to its end; a plain cursor move continues open-ended from the new position. Before, the old end time and the annotation being played were kept: clicking past them stopped playback at once, and a new range kept the old end.

The Space shortcut now starts playback exactly as the Play button does: it plays the highlighted selection from start to end (when looping is off), and otherwise plays from the cursor. It used to always play from the cursor with no end, ignoring the selection. When playback was paused part-way through the selection, both now resume from the cursor and stop at the selection's end, instead of starting the selection over. Stop, or the selection playing to its end, returns the cursor to the selection's start.

Not checked: whether the two restarts were audible with the Tone adapter; they were observed as adapter calls in tests.
