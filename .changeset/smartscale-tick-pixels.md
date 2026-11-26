---
'@waveform-playlist/ui-components': patch
---

The temporal timescale (`SmartScale`, drawn by `<WaveformTimescale />`) places each tick at the floor of its time's samples / `samplesPerPixel`, where a clip starting at that time is drawn (when the time is a whole number of samples, which holds for every tick at the common sample rates except 11025 Hz). It used to add a fractional pixel step per tick. At a zoom that is not a power of two, the rounding error put some ticks and labels one pixel early: at 48000 Hz and 1000 samples per pixel, `0:02` was at pixel 95 instead of 96. At power-of-two zooms, such as the default 1024, no tick moves. The `pixelPosition` passed to `renderTick` moves with its tick.
