---
'@waveform-playlist/browser': patch
---

`useAudioTracks` immediate mode no longer warns "Cannot create track" for configs still awaiting their audio decode — a missing duration there is an expected transient state, and each rebuild pass was re-warning for every pending track (quadratic console noise). Terminal misconfigurations (nothing left to load and no derivable duration) still warn.
