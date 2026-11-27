---
'@waveform-playlist/media-element-playout': major
---

`FadeConfig` is no longer exported (#807). It was `@waveform-playlist/core`'s type, re-exported; import it from `@waveform-playlist/core`. `MediaElementTrackOptions.fadeIn` / `fadeOut` and `setFadeIn` / `setFadeOut` take the same type as before.
