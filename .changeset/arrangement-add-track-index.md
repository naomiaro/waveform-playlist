---
'@waveform-playlist/engine': minor
---

`arrangement.addTrack(track, { index })` and `engine.addTrack(track, { index })` put the new track at that place in the order, as one undo step (left out: at the end, as before). The index is cut to a whole number and held between 0 and the number of tracks; one that is not a finite number throws a `TypeError` and changes nothing. New type `AddTrackOptions`.

The keys an engine recognises an arrangement by are now `…/arrangement/time-base/v3` and `…/arrangement/attach-decode/v3`: an engine and an arrangement from copies of the package on either side of this change refuse each other.
