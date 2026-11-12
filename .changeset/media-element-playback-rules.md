---
'@waveform-playlist/browser': major
---

`MediaElementPlaylistProvider` plays, stops, seeks and selects by the same rules as `WaveformPlaylistProvider`.

- `stop()`, the audio reaching its end, and an annotation reaching its end with continuous play off return the cursor to where playback started (before: 0).
- `play` is `(startTime?, playDuration?) => Promise<void>`: with a duration it plays a range and stops. A range that is the highlighted selection returns the cursor to the selection's start. A `play()` made before the player exists is queued.
- `seekTo` during playback restarts playback at the new position, so fades are scheduled again.
- A drag on the waveform moves the cursor to the start of the range; during playback a press moves playback at once and a drag selects nothing.
- `duration` and the peaks come from the track's waveform data and are available on the first render. `useMediaElementData()` gains `isReady`; it and `onReady` now mean that the media element has loaded its metadata. A source that cannot be loaded is reported through `onError`.
- A range and an annotation also end in a hidden tab (from the media element's `timeupdate` event).
- A custom `createPlayout` must implement `on()` and emit `loadedmetadata`.

See "MediaElement player: Stop, the ends of playback, seeking and the selection follow the multitrack player's rules" in the upgrade guide.
