---
'@waveform-playlist/browser': patch
---

Effects created before the playlist's audio engine had loaded (for example a default effect added on mount) were built on Tone's default audio context instead of the playlist's shared one. Wiring them to a track then failed with "cannot connect to an AudioNode belonging to a different AudioContext" and the playlist stayed in its loading state. `createEffectInstance` now establishes the shared context before constructing the effect.
