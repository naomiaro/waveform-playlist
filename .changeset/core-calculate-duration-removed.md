---
'@waveform-playlist/core': major
---

`calculateDuration(sampleCount, sampleRate)` is removed (#807). It returned `sampleCount / sampleRate`, the same as `samplesToSeconds(samples, sampleRate)`, which core also exports; nothing in the library called it, and `@waveform-playlist/engine` exports a different `calculateDuration(tracks)` (the end of the last clip, in seconds). Use `samplesToSeconds`.
