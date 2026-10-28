---
'@waveform-playlist/core': patch
---

`snapTickToGrid` now restarts its grid at each bar line instead of counting subdivisions from the meter entry, so odd meters stay aligned: in 7/8 at 960 PPQN a quarter-note grid is 0, 960, 1920, 2880 and then the bar line at 3360 — never 3840 — matching `@dawcore/transport`'s `quantizeTick` (#643). A subdivision longer than the bar leaves only the bar lines; an exact tie snaps up; a tick on a line (including an odd-meter bar line, which previously snapped away) stays put. `computeMusicalTicks` draws its bar/beat/eighth/sixteenth levels with the same rule, so eighth lines in 7/16 no longer cross a bar line; the coarse level is unchanged. In 4/4 and any meter whose bar is a multiple of the step, results are identical to before.
