---
'@dawcore/components': patch
---

`EffectDefinition.prepare(audioContext)`: an optional async per-context setup hook for registered effects (typically `audioWorklet.addModule`). `exportAudio()` awaits it on its internal `OfflineAudioContext` and `setEffectsState()` on the live one, so AudioWorklet-backed effects now render in exports. New `editor.prepareEffect(type)` and exported `prepareEffect(type, audioContext)` cover the synchronous `addEffect()` path.
