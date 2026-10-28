---
'@dawcore/transport': patch
---

Tick conversions now round exactly once, at the integer-`Tick` boundary. New fractional variants expose the unrounded position for sub-tick placement (e.g. a recorded note between ticks before quantising): `TempoMap.secondsToTicksExact()`, `SampleTimeline.samplesToTicksExact()` and `Transport.timeToTickExact()`. `secondsToTicks()`, `samplesToTicks()` and `timeToTick()` are unchanged in contract (`Math.round` of the exact value), `SampleTimeline.samplesToTicks()` no longer rounds twice, and `ticksToSeconds()`/`tickToTime()` accept a fractional position so an exact value converts back without a cast. `NativePlayoutAdapter.secondsToTicksExact()` carries the fractional path through the engine's `PlayoutAdapter` (new optional member). `TempoMap.secondsToBeats()` is now continuous instead of quantised to whole ticks.
