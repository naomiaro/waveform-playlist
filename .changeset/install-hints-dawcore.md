---
'@dawcore/components': patch
---

The install hints in `<daw-editor>`'s errors (no adapter set; `loadMidi()` without `@dawcore/midi`; recording without `@waveform-playlist/worklets`; anything that loads `@dawcore/wam` or `@dawcore/faust`, such as WAM and Faust effects and their generic panels) now give the command with the version range this build peers on, in the form `npm install "<package>@<range>"`. A bare `npm install <name>` installs npm `latest`, which a prerelease of `@dawcore/components` does not always accept (transport 0.0.15 against `>=0.0.16-0`). The no-adapter error names `@waveform-playlist/playout`, which dawcore does not peer on, with a caret on the playout version released beside this build.
