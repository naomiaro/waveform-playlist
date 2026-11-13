---
'@waveform-playlist/browser': major
---

The MediaElement waveform (`<MediaElementWaveform>`, `<MediaElementPlaylist>`) is drawn by the same components as the multitrack view. Its props are unchanged; what changes is on screen and in the markup:

- `className` is on the playlist's outermost element, which now carries `data-playlist-state="ready"` (always: the waveform does not wait for the player; `useMediaElementTrack().isReady` says whether the player has loaded).
- The track's element is inside two more `div`s: a `[data-track-row]` (`data-track-id="media-element-track-0"`, `data-track-kind="audio"`, `data-selected="true"`) and a positioning container. Selectors written for the multitrack view's rows now match this player's row too.
- `theme.playlistBackgroundColor` is used when set.
- With `showFades`, the fade-out curve is placed from the clip's width (up to one pixel further left). The one clip in `useMediaElementTrack().peaksDataArray` carries the track's fades.
- The provider's `controls={{ show: true, … }}` no longer draws an empty column.
- Peak data that cannot be read gives the track's row with nothing in it (one `waveHeight` tall, still clickable), not the text "Loading waveform...".
- A press, a release, play, pause and stop no longer render the track, its clip and its channels. `getAnnotationBoxLabel` is no longer called for them or when the player becomes ready, and `renderPlayhead` is no longer called for a press or release that does not move the cursor (it is still called on play, pause and stop).
