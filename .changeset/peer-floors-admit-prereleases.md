---
'@dawcore/components': patch
'@waveform-playlist/engine': patch
'@waveform-playlist/playout': patch
---

The peer ranges on other packages of this repository also accept the prereleases of their next version (`>=7.0.0 || >=13.0.0-0` for the engine's peer on core), so a `@next` install does not report an unmet peer. What a stable install accepts is unchanged.
