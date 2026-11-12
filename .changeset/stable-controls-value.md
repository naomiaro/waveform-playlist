---
'@waveform-playlist/browser': major
---

**The value of `usePlaylistControls()` no longer changes with `duration` or the time format (#767).** `seekTo` and the animation loop read the timeline end through a ref, so `play`, `seekTo` and the controls value keep their identity while the end of the timeline moves (for example while the last clip is trimmed). `useMediaElementControls()` likewise no longer changes when the duration loads.

**Breaking: `formatTime` is removed from `usePlaylistControls()` and `minimumPlaylistHeight` from `usePlaylistData()`.** Nothing read either. Use `formatTime(seconds, timeFormat)` from `@waveform-playlist/ui-components` with `timeFormat` from `usePlaylistData()`, and `tracks.length * waveHeight + timeScaleHeight`. See `/docs/react/upgrading`.
