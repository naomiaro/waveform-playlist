---
'@dawcore/transport': patch
---

Add grid snapping: `Transport.quantizeTick(tick, subdivision, { mode, strength })` and the standalone pure function `quantizeTick(meterMap, …)`. `subdivision` is a tick count, `'bar'` or `'beat'`; `mode` is `'nearest'` (default, ties go up), `'next'` or `'previous'`; `strength` (0–1) scales the move, like Tone's `Time.quantize(subdiv, percent)`. Grid lines restart at each bar line, so odd meters stay aligned (in 7/8 a quarter-note grid runs 0, 960, 1920, 2880, then the bar line at 3360). The input tick may be fractional — pair it with `timeToTickExact()` to quantise a recorded note — and the result is always an integer tick.
