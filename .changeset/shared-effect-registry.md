---
'@waveform-playlist/core': minor
'@dawcore/components': patch
---

The effect registry moves to `@waveform-playlist/core`, so one `registerEffect()` call serves `<daw-editor>` and the React effects hooks: `registerEffect`, `unregisterEffect` (new), `getEffectDefinitions`, `prepareEffect`, `ensureEffectPrepared`, `needsPrepare`, `createEffectInstance`, and the types `NativeEffectDefinition`, `NativeEffectInstance`, `EffectParamDef` (new optional `label`) and `CreatedNativeEffect`. The registry is kept on `globalThis`, so two installed copies of core share it.

**Breaking for `@dawcore/components`:** it no longer exports `registerEffect`, `getEffectDefinitions`, `createEffectInstance`, `prepareEffect`, or the types `EffectDefinition`, `EffectInstance` and `EffectParamDef`. Import them from `@waveform-playlist/core` (`EffectDefinition` is now `NativeEffectDefinition`, `EffectInstance` is `NativeEffectInstance`). The `native-*` built-ins are still registered when `@dawcore/components` is imported, and `editor.prepareEffect(type)` is unchanged.
