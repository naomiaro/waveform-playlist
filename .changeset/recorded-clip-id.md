---
'@dawcore/components': patch
---

Recorded takes are addressable from code: a new `daw-recording-clip-add` event (`{ trackId, clipId }`) fires once the take's clip is in the engine, and the take's entry in `editor.tracks[n].clips` carries the same `clipId`. `updateClip()` / `removeClip()` on such element-less clips now keep `editor.tracks` in sync.
