---
'@waveform-playlist/browser': patch
---

Keep the provider's context values stable across renders. `usePlaylistControls()` no longer returns a new object on every provider render (`formatTime` from `useTimeFormat` is now memoized, and `seekTo` / `setSelection` / the track setters no longer change identity with playback or mixer state), `usePlaylistData()` no longer changes when the `controls` prop is omitted, and the styled-components theme object is merged once per `theme` prop instead of per render. Applies to `MediaElementPlaylistProvider` too (theme and `controls` default).

Also fixes dropped updates: two of `setTrackMute` / `setTrackSolo` / `setTrackVolume` / `setTrackPan` called in the same batch previously kept only the last one.
