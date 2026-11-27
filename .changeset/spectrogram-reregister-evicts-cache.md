---
'@dawcore/spectrogram': patch
---

The spectrogram worker draws the new audio when different audio is registered under an id that already has audio (`registerAudioData` on `createSpectrogramWorker` or `createSpectrogramWorkerPool`). It used to keep the FFT results of the old audio under that id, so a request with the same parameters drew the old spectrum; only `unregisterAudioData` dropped them. A `computeFFT` still running when its id's audio is replaced or unregistered now rejects with `SpectrogramAbortError` and keeps nothing; it used to finish on the old audio and cache it under the id. When a clip is registered again on a `SpectrogramOrchestrator` while its spectrogram is being computed, `viewport-ready` for its track fires once the new audio is drawn; it used to fire after the old audio was drawn. The React `SpectrogramProvider` registers only ids the pool does not hold, and `<daw-editor>` unregisters a clip before it registers it again, so neither drew the old spectrum.
