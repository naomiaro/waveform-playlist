---
'@dawcore/components': patch
---

Clip, annotation and timeline drag snapping (`snap-to`) now restarts the grid at each bar line in odd meters, and the ruler draws its grid the same way, via `@waveform-playlist/core`'s `snapTickToGrid`/`computeMusicalTicks` fix (#643). A quarter-note snap in 7/8 lands on 0, 960, 1920, 2880, 3360 — the bar line — instead of 3840, agreeing with `Transport.quantizeTick`. Standard meters are unaffected.
