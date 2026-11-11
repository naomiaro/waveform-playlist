---
'@waveform-playlist/browser': patch
---

`useDynamicEffects` and `useTrackDynamicEffects` rewire an effects chain only when its wiring changes (an effect added, removed, reordered, or a WAM entry bypassed). A parameter change used to disconnect and reconnect the whole live chain on every slider step, and the per-track hook did so for every track that had effects.
