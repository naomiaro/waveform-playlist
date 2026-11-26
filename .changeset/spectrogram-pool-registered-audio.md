---
'@dawcore/spectrogram': patch
---

`SpectrogramWorkerApi` has a new method, `registeredAudioClipIds(): string[]`: the ids whose audio is registered with the worker or the pool now, registered and not unregistered since. It returns a new array on every call and is empty once terminated. `createSpectrogramWorker` and `createSpectrogramWorkerPool` implement it. An object of your own typed as `SpectrogramWorkerApi`, for example a test fake, needs it too.
