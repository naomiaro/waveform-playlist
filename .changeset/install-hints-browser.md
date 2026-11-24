---
'@waveform-playlist/browser': patch
---

The install hints in the errors for a missing optional package (`@waveform-playlist/playout` and `tone`, `@waveform-playlist/media-element-playout`, `@dawcore/wam`) now name the version range this build of browser peers on, e.g. `npm install "@waveform-playlist/playout@^13.0.0-next.1" "tone@^15.0.0"`. A bare `npm install <name>` installed npm `latest`, which a prerelease of browser does not accept, and which can be a newer major than a stable browser accepts.
