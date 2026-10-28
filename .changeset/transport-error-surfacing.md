---
'@dawcore/transport': patch
---

Scheduler and Transport now reject invalid loop points with a thrown error instead of a `console.warn` that left the previous loop silently in force: `setLoop`, `setLoopSeconds` and `setLoopSamples` throw when `enabled` and the range is non-finite, empty or inverted (shared `assertValidLoopRange`, same policy as `TempoMap`'s BPM check). `NativePlayoutAdapter.setLoop` translates the engine's default empty region (`loopStart = loopEnd = 0`, reachable via `setLoopEnabled(true)` before a region is chosen) to a disabled loop so UI toggles don't throw.

Listener failures are surfaced instead of swallowed: `Scheduler` accepts an `onError` option and `Transport` emits a new `error` event with a `SchedulerListenerError` payload (`phase: 'generate' | 'consume'`, `listener`, `event?`, `error`). The failing listener is skipped for that window (or that one event) and the rest proceed. With no `error` subscriber the transport falls back to `console.warn`, so the default stays visible.
