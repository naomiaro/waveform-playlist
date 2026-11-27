---
'@waveform-playlist/media-element-playout': major
---

`FadeConfig` is no longer exported (#807). It was `@waveform-playlist/core`'s type, re-exported; import it from `@waveform-playlist/core` (with a strict package manager such as pnpm, add `@waveform-playlist/core` to your own dependencies if it is only there as a dependency of another package). `MediaElementTrackOptions.fadeIn` / `fadeOut` and `setFadeIn` / `setFadeOut` take the same type as before.
