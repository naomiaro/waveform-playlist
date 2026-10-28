---
'@dawcore/transport': patch
---

Tick conversions now round exactly once, at the integer-`Tick` boundary. New fractional variants expose the unrounded position for sub-tick placement (e.g. a recorded note between ticks before quantising): `TempoMap.secondsToTicksExact()`, `SampleTimeline.samplesToTicksExact()` and `Transport.timeToTickExact()`. `secondsToTicks()`, `samplesToTicks()` and `timeToTick()` are unchanged in contract (`Math.round` of the exact value), and `SampleTimeline.samplesToTicks()` no longer rounds twice. `TempoMap.secondsToBeats()` is now continuous instead of quantised to whole ticks.
