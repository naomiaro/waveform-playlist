---
'@waveform-playlist/browser': patch
---

Chorus, tremolo, auto panner and auto filter modulate. Tone.js builds the LFO of these four effects stopped and runs it only after `start()`, which nothing called: each was a fixed delay, gain, pan and filter, during playback and in an exported WAV. `createToneEffectInstance` now starts them, so the master chain (`useDynamicEffects`), the track chains (`useTrackDynamicEffects`) and the WAV export all get a running LFO. A mix that used one of the four sounds different, and so does its export.

Code that calls `createToneEffectInstance` itself and then `start()` on the node (`instance.input`) should drop that call: a second `start()` at the same time throws in Tone.js ("Start time must be strictly greater than previous start time").
