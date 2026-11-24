---
'@waveform-playlist/browser': patch
---

The errors and warnings that ask you to install an optional package now give the install command with the version range this build of browser was published with, in the form `npm install "<package>@<range>"`: the default engines (`@waveform-playlist/playout` with `tone`, `@waveform-playlist/media-element-playout`), `@dawcore/wam`, and the annotation and spectrogram integrations (`useAnnotationIntegration`, `<AnnotationList>`, `useSpectrogramIntegration`). A bare `npm install <name>` installs npm `latest`, which can be outside the range a prerelease of browser accepts (playout 12.5.5 against `^13.0.0-next.1`) or a newer major than a stable browser accepts. Spectrogram, which browser does not peer on, is named with a caret on the version released beside this build.
