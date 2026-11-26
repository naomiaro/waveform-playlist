---
'@waveform-playlist/ui-components': patch
---

The temporal timescale (`SmartScale`, drawn by `<WaveformTimescale />`) places each tick at the floor of its time's samples / `samplesPerPixel`, the pixel a clip starting at that time is drawn at. It used to add a fractional pixel step per tick, and the rounding error put ticks and labels one pixel early: at 48000 Hz and 1000 samples per pixel, the default zoom, `0:02` was at pixel 95 instead of 96. The `pixelPosition` passed to `renderTick` moves with them.
