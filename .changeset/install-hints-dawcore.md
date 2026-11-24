---
'@dawcore/components': patch
---

The install hints in `<daw-editor>`'s errors (no adapter set; `loadMidi()` without `@dawcore/midi`; recording without `@waveform-playlist/worklets`; anything that loads `@dawcore/wam` or `@dawcore/faust`, such as WAM and Faust effects and their generic panels) now give the command with a version range, in the form `npm install "<package>@^<version>"`: a caret on the version of that package released beside this build, which lies inside dawcore's peer range. A bare `npm install <name>` installs npm `latest`, which a prerelease of `@dawcore/components` does not always accept (transport 0.0.15 against `>=0.0.16-0`), and the peer range alone (`>=0.0.16-0`) would also admit a later breaking release. The no-adapter error names `@waveform-playlist/playout`, which dawcore does not peer on, the same way.
