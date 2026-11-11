---
'@waveform-playlist/browser': major
---

Custom effects in the React effects hooks, and the effect lists are no longer hook state.

**New:** a type registered with `registerEffect()` from `@waveform-playlist/core` (an `AudioWorkletNode`, or any chain of native nodes) can be added to the master chain and to a track chain by id (`addEffect(id)`, `addEffectToTrack(trackId, id)`), with parameter updates, bypass, reorder, remove and WAV export. Its `prepare` hook is awaited on the live context when it is added and on the offline context at export. Custom effects need native-context mode (`configureGlobalContext({ nativeAudioContext: true })`), like WAM plugins. `availableEffects` lists registered types after the built-ins. New exports from `/tone`: `useActiveEffects`, `getAvailableEffects`, `createCustomEffectInstance`, `CustomEffectInstance`, `EffectCategory`, `BuiltInEffectCategory`. New: `reorderTrackEffects(trackId, fromIndex, toIndex)`.

**Breaking:**

- `useDynamicEffects()` returns `effects` (a `ValueSource<ActiveEffect[]>`) instead of `activeEffects`; `useTrackDynamicEffects()` returns `getTrackEffects(trackId)` instead of `trackEffectsState` (`TrackEffectsState` is removed). Read a chain with `useActiveEffects(source)` in the component that draws it. The hooks no longer re-render their caller when a chain changes, and everything they return keeps its identity (effects example: 214 component renders per slider step before, 34 after).
- `addEffect` and `addEffectToTrack` return `Promise<string>` (the new entry's `instanceId`) and reject for an unknown id. A built-in effect is still in the chain before the call returns.
- `createOfflineEffectsFunction()` and `createOfflineTrackEffectsFunction(trackId)` always return a function (never `undefined`), the same one on every call; it reads the chain when the export runs. `getTrackEffectsFunction(trackId)` returns the same function for the same track and never `undefined`.
- `EffectInstance` has `input` and `output` instead of `effect`.
- `EffectDefinition['category']` accepts any string (`EffectCategory`); `ActiveEffect['kind']` gains `'custom'`, and `ActiveEffect` gains an optional `wetParam`.

**Fixed:** bypassing a built-in effect with no wet control (compressor, limiter, gate, EQ3) did nothing during playback; it is now taken out of the chain. Changing the wet level of a bypassed effect no longer makes it audible.
