---
'@waveform-playlist/browser': major
---

`createEffectInstance` of `@waveform-playlist/browser/tone` is renamed `createToneEffectInstance`, with the same arguments `(definition, initialParams?)` and the same result (#807). `@waveform-playlist/core` exports a different function under the old name, the effect registry's `createEffectInstance(type, audioContext, params)`, so an import of one could be mistaken for the other. A leftover import of the old name from `@waveform-playlist/browser/tone` is a TypeScript error; without TypeScript it is a failed build or `undefined` at runtime, depending on the bundler (the upgrade guide says which).
