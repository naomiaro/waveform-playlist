---
'@dawcore/transport': patch
---

`Transport` emits a new `tick` event (`{ seconds }`, the same clamped position `getCurrentTime()` returns) once per scheduler tick while playing — after the scheduler consumed the tick, never during a count-in nor on the tick that ends a bounded play. It is driven by the Worker timer, so it keeps its 25 ms cadence in a hidden tab where `requestAnimationFrame` stops; consumers that must poll the playhead for state the transport does not announce (a tempo-map boundary crossed mid-playback) subscribe to it instead of rAF. UI position updates should still use rAF.
