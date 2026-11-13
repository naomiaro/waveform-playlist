---
'@waveform-playlist/browser': major
---

The MediaElement waveform (`<MediaElementWaveform>`, `<MediaElementPlaylist>`) is drawn by the same components as the multitrack view. Its props are unchanged; what changes is on screen and in the markup:

- `className` is on the playlist's outermost element, which now carries `data-playlist-state` (`"loading"` until the media element has its metadata, then `"ready"`).
- The track is one `[data-track-row]` (`data-track-id="media-element-track-0"`, `data-track-kind="audio"`, `data-selected="true"`), inside two more `div`s.
- `theme.playlistBackgroundColor` is used when set.
- With `showFades`, the fade-out curve is placed from the clip's width (up to one pixel further left). The one clip in `useMediaElementTrack().peaksDataArray` carries the track's fades.
- The provider's `controls={{ show: true, … }}` no longer draws an empty column.
- Peak data that cannot be read gives an empty timeline, not the text "Loading waveform...".
- A press, a release, play, pause and stop no longer render the track, its clip and its channels, and no longer call `renderPlayhead` or `getAnnotationBoxLabel` by themselves.
