---
'@waveform-playlist/annotations': patch
---

`AnnotationText` prints a time just under a minute as the next minute (`1:00.000` for 59.9996 s, not `0:60.000`), and a negative time as `0:00.000` (#815). The `formatTime` it hands to `renderAnnotationItem` is the same function.
