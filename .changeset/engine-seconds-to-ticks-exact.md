---
'@waveform-playlist/engine': patch
---

`PlayoutAdapter` gains an optional `secondsToTicksExact(seconds): number` for the fractional tick position (sub-tick placement, e.g. a recorded note between ticks before quantising). `secondsToTicks` is documented as returning an integer tick and `ticksToSeconds` as accepting a fractional position. Additive; existing adapters are unaffected.
