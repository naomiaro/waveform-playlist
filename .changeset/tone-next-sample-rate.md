---
'@waveform-playlist/playout': patch
'@waveform-playlist/browser': patch
---

`configureGlobalContext({ sampleRate })` now passes the rate to Tone.js's `Context` on the default (standardized-audio-context) path. Tone.js 15.5.x (`tone@next`) honours it; Tone.js 15.1.x still ignores it there, runs at the hardware rate and logs the existing mismatch warning. The return value is the rate actually in use on both.

`tone@next` is now tested in CI alongside the stable line, including a contract test for the Tone.js private fields this package relies on.

Mute and WAV-export fades no longer read Tone.js's private `_param`: they write the native `AudioParam` through the public `Gain.input.gain`. Behaviour is unchanged (it is the same object). `getUnderlyingAudioParam` is deprecated; it still works, and nothing in the library calls it.
