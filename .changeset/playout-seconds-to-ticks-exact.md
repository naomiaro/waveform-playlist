---
'@waveform-playlist/playout': patch
---

`TonePlayoutAdapter` implements the engine's new optional `secondsToTicksExact(seconds)` (single-tempo: `seconds × bpm × ppqn / 60`), for parity with `NativePlayoutAdapter`.
