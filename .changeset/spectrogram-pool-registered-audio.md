---
'@dawcore/spectrogram': patch
---

`SpectrogramWorkerApi` has a new method, `registeredAudioClipIds(): string[]`: the ids whose audio is registered with the worker or the pool now, registered and not unregistered since. An id is whatever the audio was registered under: a clip id, or a key per `AudioBuffer`, as `SpectrogramProvider` now uses. It returns a new array on every call. `terminate()` empties it, and a `registerAudioData` or `unregisterAudioData` after `terminate()` is ignored, on `createSpectrogramWorker` as on the pool (the worker client used to post it to the terminated worker). `createSpectrogramWorker` and `createSpectrogramWorkerPool` implement it. An object of your own typed as `SpectrogramWorkerApi`, for example a test fake, needs it too.
