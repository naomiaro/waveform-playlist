---
'@dawcore/components': patch
'@waveform-playlist/engine': major
'@waveform-playlist/playout': patch
---

Peer ranges and prereleases.

- `@waveform-playlist/engine` requires `@waveform-playlist/core` 13 (`>=13.0.0-0`, which includes its prereleases). The range was `>=7.0.0`, while the engine imports `createSourceLoader`, `createValueSource`, `isLoadingClip` and `assertTrackKind`, which core has from 13 on.
- `@dawcore/components` and `@waveform-playlist/playout`: the hand-written peer ranges on other packages of this repository also accept the prereleases of the peer's next version (e.g. `>=13.5.0 || >=14.0.0-0`), so an install of `@next` with npm does not report an unmet peer. What a stable install accepts is unchanged.
