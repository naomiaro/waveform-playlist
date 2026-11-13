---
'@waveform-playlist/browser': patch
---

Keep the provider's context values stable across renders. `usePlaylistControls()` no longer returns a new object on every provider render (`formatTime` from `useTimeFormat` is now memoized, and `seekTo` / `setSelection` / the track setters no longer change identity with playback or mixer state), `usePlaylistData()` no longer changes when the `controls` prop is omitted, and the styled-components theme object is merged once per `theme` prop instead of per render. `controls` and `theme` passed as inline object literals are compared shallowly, so a parent re-render with equal contents no longer invalidates them either. Applies to `MediaElementPlaylistProvider` too (theme and `controls`).

Also fixes dropped updates: two of `setTrackMute` / `setTrackSolo` / `setTrackVolume` / `setTrackPan` called in the same batch previously kept only the last one. (These four take a track id, not an index, since the track-control pieces change: see that entry.)

The default track controls are now disabled while their track is still loading (no mixer state yet, e.g. under `deferEngineRebuild`), instead of accepting clicks that could not take effect. A track setter called for such a track is ignored. The volume and pan sliders gain `aria-label`s ("Volume", "Pan") and the Mute/Solo buttons expose `aria-pressed`.
