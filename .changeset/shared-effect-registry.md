---
'@waveform-playlist/core': minor
'@dawcore/components': patch
---

The effect registry moves to `@waveform-playlist/core`, so one `registerEffect()` call serves `<daw-editor>` and the React effects hooks: `registerEffect`, `unregisterEffect` (new), `getEffectDefinitions`, `prepareEffect`, `ensureEffectPrepared`, `needsPrepare`, `createEffectInstance`, and the types `NativeEffectDefinition`, `NativeEffectInstance`, `EffectParamDef` (new optional `label`) and `CreatedNativeEffect`. The registry is kept on `globalThis`, so two installed copies of core share it. `NativeEffectInstance.output` has a stated contract: the host owns every connection out of `output` and disconnects all of them when it rewires the chain, so an effect must not connect `output` to anything inside itself. `createEffectInstance` disposes an instance whose initial `applyParams` throws.

**Breaking for `@dawcore/components`:** it no longer exports `registerEffect`, `getEffectDefinitions`, `createEffectInstance`, `prepareEffect`, or the types `EffectDefinition`, `EffectInstance` and `EffectParamDef`. Import them from `@waveform-playlist/core` (`EffectDefinition` is now `NativeEffectDefinition`, `EffectInstance` is `NativeEffectInstance`). The `native-*` built-ins are still registered when `@dawcore/components` is imported, each only when that name is not already registered (an earlier registration is kept, with no overwrite warning), and `editor.prepareEffect(type)` is unchanged.
