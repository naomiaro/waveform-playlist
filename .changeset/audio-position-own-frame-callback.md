---
'@waveform-playlist/browser': patch
---

Two `<AudioPosition />` readouts under one provider both follow playback. They registered their frame callback under the same id, so the second replaced the first, which stood still while playing.

Internally, `PlaylistVisualization` is now built from a root and one part per thing it draws (timescale, track controls, tracks, annotation row, selection, playhead, loop region). Its props and what it renders are unchanged; the parts are not exported yet. A custom `renderPlayhead` is called less often: no longer on every timeline change, track selection or reorder drag-over when the component that renders `<Waveform>` did not itself re-render. `getAnnotationBoxLabel` is likewise called only when the row of annotation boxes renders, not on every render of the view.
