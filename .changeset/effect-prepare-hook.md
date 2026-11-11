---
'@dawcore/components': patch
---

A registered effect definition's `prepare(audioContext)`: an optional async per-context setup hook for registered effects (typically `audioWorklet.addModule`). `exportAudio()` awaits it on its internal `OfflineAudioContext` and `setEffectsState()` on the live one, so AudioWorklet-backed effects now render in exports. New `editor.prepareEffect(type)` covers the synchronous `addEffect()` path (`prepareEffect(type, audioContext)` itself is exported from `@waveform-playlist/core`).
