---
'@waveform-playlist/annotations': patch
---

`AnnotationText` renders each row through a memoized item. When the active annotation changes, which happens at every annotation boundary during playback, only the row that stops being active and the row that becomes active render; before, every row did. A custom `renderAnnotationItem` is called for those two rows only, so it must not depend on values that it does not receive as arguments and that change without the `annotations`, the active annotation or the function itself changing.

No API change. Measured together with the matching change to the annotation boxes in `@waveform-playlist/browser`, on the annotations example (15 annotations), development build, 4x CPU throttle: 265 components and 16 to 22 ms of React render per boundary before, 48 components and 5.3 to 6.8 ms after.
