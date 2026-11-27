---
'@waveform-playlist/core': major
---

`TrackSpectrogramOverrides.renderMode` is optional. An override holds only what was set: a render mode by `setTrackRenderMode` (the track menu), a config and colour map by `setTrackSpectrogramConfig` (the spectrogram settings). A field it does not have falls back to the track's own value. Code that reads `override.renderMode` as a `RenderMode` now gets `RenderMode | undefined`: fall back to the track's mode, `override?.renderMode ?? track.renderMode ?? 'waveform'`. Migration: `website/docs/react/upgrading.md`, "`TrackSpectrogramOverrides.renderMode` is optional".
