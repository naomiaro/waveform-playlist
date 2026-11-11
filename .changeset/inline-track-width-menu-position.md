---
'@waveform-playlist/ui-components': patch
'@waveform-playlist/annotations': patch
---

Track width (`Track`, `AnnotationBoxesWrapper`, `AnnotationsTrack`) and the `TrackMenu` dropdown position are now inline styles instead of styled-components template interpolations, so they no longer generate a new CSS class for every distinct value (every zoom step, every pixel of timeline growth while recording, every scroll position while a menu is open). `TrackMenu` also listens for scroll passively and measures at most once per animation frame.
