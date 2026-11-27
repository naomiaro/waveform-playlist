---
'@waveform-playlist/browser': patch
---

Chorus, tremolo, auto panner and auto filter modulate. Tone.js builds the LFO of these four effects stopped and runs it only after `start()`, which nothing called: each was a fixed delay, gain, pan and filter, during playback and in an exported WAV. `createToneEffectInstance` now starts them, so the master chain (`useDynamicEffects`), the track chains (`useTrackDynamicEffects`) and the WAV export all get a running LFO. A mix that used one of the four sounds different, and so does its export.

Code that creates one of the four itself (`createToneEffectInstance`, named `createEffectInstance` before, whose node is `instance.input`, `instance.effect` before) and then calls `start()` on the node should drop that call: a second `start()` at the same audio time throws in Tone.js ("Start time must be strictly greater than previous start time"), which is always the case while the audio context is suspended and in an offline render. The upgrade guide has the find-and-replace.

An effect of the four added before the audio context first runs makes Tone.js log its 'The AudioContext is "suspended"' warning, as a phaser or vibrato already did on Tone 15.1.x.
