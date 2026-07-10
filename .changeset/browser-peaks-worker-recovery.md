---
'@waveform-playlist/browser': patch
---

A single peaks-worker crash no longer poisons waveform generation for the provider's lifetime — `useWaveformDataCache` detects the crashed worker (new `isTerminated()` on `PeaksWorkerApi`) and spawns a fresh one on the next request. Mirror of the same fix in `@dawcore/components`.
