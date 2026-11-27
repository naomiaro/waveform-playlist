---
'@waveform-playlist/core': major
---

`TrackSpectrogramOverrides.renderMode` is optional. An override holds only what the user chose: a render mode from the track menu, a config and colour map from the spectrogram settings. A field it does not have falls back to the track's own value. Code that reads `override.renderMode` as a `RenderMode` now gets `RenderMode | undefined`: fall back to the track's mode, `override?.renderMode ?? track.renderMode ?? 'waveform'`. See the upgrade guide.
