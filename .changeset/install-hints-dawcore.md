---
'@dawcore/components': patch
---

The install hints in `<daw-editor>`'s errors (no adapter set; `loadMidi()` without `@dawcore/midi`; WAM and Faust effects without `@dawcore/wam` or `@dawcore/faust`; recording without `@waveform-playlist/worklets`) now name the version range this build peers on, e.g. `npm install "@dawcore/transport@>=0.0.16-0"`. A bare `npm install <name>` installed npm `latest`, which a prerelease of `@dawcore/components` does not always accept (transport 0.0.15 against `>=0.0.16-0`). The no-adapter error names `@waveform-playlist/playout` with a caret on the version released beside this build.
