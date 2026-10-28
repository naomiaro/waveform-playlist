---
'@dawcore/transport': patch
---

Scheduler and Transport now reject invalid loop points with a thrown error instead of a `console.warn` that left the previous loop silently in force: `setLoop`, `setLoopSeconds` and `setLoopSamples` throw when `enabled` and the range is non-finite, empty or inverted (shared `assertValidLoopRange`, same policy as `TempoMap`'s BPM check), and the seconds/sample variants also throw, in the caller's unit, when a non-empty range rounds to a single tick. `NativePlayoutAdapter.setLoop` translates a region that is empty in ticks (the engine's default `loopStart = loopEnd = 0`, or a sub-tick selection) to a disabled loop so UI toggles don't throw, warning only when the region is inverted.

Listener failures are surfaced instead of swallowed: `Scheduler` accepts an `onError` option and `Transport` emits a new `error` event with a `SchedulerListenerError` payload (`phase: 'generate' | 'consume' | 'positionJump'`, `listener`, `event?`, `error`), delivered on a microtask after the scheduler window completes. The failing listener is skipped for that window (or that one event / jump) and the rest proceed; a throwing `onPositionJump` no longer aborts a loop wrap. With no `error` subscriber the transport falls back to `console.warn`, once per listener and phase, so the default stays visible without flooding.
