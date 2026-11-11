---
'@waveform-playlist/browser': major
---

Custom effects in the React effects hooks, and the effect lists are no longer hook state.

**New:** a type registered with `registerEffect()` from `@waveform-playlist/core` (an `AudioWorkletNode`, or any chain of native nodes) can be added to the master chain and to a track chain by id (`addEffect(id)`, `addEffectToTrack(trackId, id)`), with parameter updates, bypass, reorder, remove and WAV export. Its `prepare` hook is awaited on the live context when it is added and on the offline context at export. Custom effects need native-context mode (`configureGlobalContext({ nativeAudioContext: true })`), like WAM plugins. `availableEffects` lists the built-ins and, in native-context mode only, the registered custom types; it is read when the calling component renders (not subscribed), so register custom effects before the component that shows the picker renders. Adding by id does not depend on it. A type registered again while its `prepare` was running is added as the new definition, and `updateParameter` ignores a non-number for a custom effect. New exports from `/tone`: `useActiveEffects`, `getAvailableEffects`, `createCustomEffectInstance`, `CustomEffectInstance`, `EffectParameterValue`, `EffectCategory`, `BuiltInEffectCategory`. New: `reorderTrackEffects(trackId, fromIndex, toIndex)`.

**Breaking:**

- `useDynamicEffects()` returns `effects` (a `ValueSource<ActiveEffect[]>`) instead of `activeEffects`; `useTrackDynamicEffects()` returns `getTrackEffects(trackId)` instead of `trackEffectsState` (`TrackEffectsState` is removed). Read a chain with `useActiveEffects(source)` in the component that draws it. The hooks no longer re-render their caller when a chain changes, and everything they return keeps its identity (effects example: 214 component renders per slider step before, 34 after).
- `addEffect` and `addEffectToTrack` return `Promise<string>` (the new entry's `instanceId`) and reject for an unknown id. A built-in effect is still in the chain before the call returns.
- `createOfflineEffectsFunction()` and `createOfflineTrackEffectsFunction(trackId)` always return a function (never `undefined`), the same one on every call; it reads the chain when the export runs. `getTrackEffectsFunction(trackId)` returns the same function for the same track and never `undefined`.
- `EffectInstance` has `input` and `output` instead of `effect`.
- `ActiveEffect['kind']` is `'tone' | 'wam' | 'custom'`: the built-in Tone.js kind is renamed from `'native'` to `'tone'` (in core and dawcore "native" means a registry effect built from native nodes), and `'custom'` is new. `<daw-editor>`'s own `kind: 'native'` is unchanged.
- The effect chains survive a remount: the hooks no longer dispose their effects in an unmount cleanup, so a StrictMode remount, Fast Refresh and a hidden `<Activity>` keep the list and its live instances (add defaults on mount behind a ref guard). After a real unmount the instances are disposed when the chain is garbage-collected (a `FinalizationRegistry`; best effort, not prompt), or at a known moment by `clearAllEffects()` / `clearTrackEffects(trackId)`. A clear also drops an add still in flight (its promise rejects); an unmount no longer aborts one.
- `EffectDefinition['category']` accepts any string (`EffectCategory`), and `ActiveEffect` gains an optional `wetParam`.

**Fixed:** bypassing a built-in effect with no wet control (compressor, limiter, gate, EQ3) did nothing during playback; it is now taken out of the chain. Changing the wet level of a bypassed effect no longer makes it audible. A change that cannot be wired (a node on another AudioContext) restores the previous chain and rejects, instead of leaving the list and the graph out of step.
