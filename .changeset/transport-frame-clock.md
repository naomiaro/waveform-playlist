---
'@dawcore/transport': patch
---

`Clock` keeps its position in integer AudioContext frames on the 128-frame render-quantum lattice; seconds are now a derived view (`getTime() = getFrameExact() / sampleRate`). New: `Clock.getFrame()` / `getFrameExact()` / `seekToFrame()` / `sampleRate` / `rebaseCount`, `Transport.getCurrentFrame()`, and the exported `RENDER_QUANTUM_FRAMES`. A context reading that goes backwards (Chromium re-basing `currentTime` on some device changes) is absorbed by moving the anchor so the position holds instead of jumping back; a stalled reading simply freezes the position. `toAudioTime()` while running is anchor-based and never re-reads `currentTime`, so float noise in a reading cannot shift scheduled start times. Seconds-based behavior is unchanged.
