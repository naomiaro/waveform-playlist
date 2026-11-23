---
'@waveform-playlist/annotations': patch
'@waveform-playlist/browser': patch
'@waveform-playlist/core': patch
'@dawcore/components': patch
'@dawcore/faust': patch
'@dawcore/midi': patch
'@dawcore/spectrogram': patch
'@dawcore/wam': patch
'@waveform-playlist/engine': patch
'@waveform-playlist/media-element-playout': patch
'@waveform-playlist/midi': patch
'@waveform-playlist/playout': patch
'@waveform-playlist/recording': patch
'@waveform-playlist/spectrogram': patch
'@dawcore/transport': patch
'@waveform-playlist/ui-components': patch
'@waveform-playlist/webaudio-peaks': patch
'@waveform-playlist/worklets': patch
---

Prereleases are published from GitHub Actions, with npm provenance: after every merge to `dev` that carries a changeset, the packages it changes and their dependents are published under the npm dist-tag `next`. `@dawcore/components` gets the `repository` field that provenance needs. No change to any package's code.
