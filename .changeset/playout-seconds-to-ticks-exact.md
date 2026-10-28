---
'@waveform-playlist/playout': patch
---

`TonePlayoutAdapter` implements the engine's new optional `secondsToTicksExact(seconds)` (single-tempo: `seconds × bpm × ppqn / 60`), for parity with `NativePlayoutAdapter`. `secondsToTicks` now rounds to an integer tick as the engine interface documents (it previously returned the fractional value, so `PlaylistEngine` cached fractional `startTick`s on the Tone backend while the native backend and the headless fallback produced integers).
