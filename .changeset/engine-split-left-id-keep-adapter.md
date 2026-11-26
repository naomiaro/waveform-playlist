---
'@waveform-playlist/engine': minor
---

A split keeps the clip's id on the left half (#848). `splitClip` (the arrangement's, the engine's and the pure one in `operations`) used to give both halves new ids; now the left half keeps the original `id` and only the right half gets a new one, so whatever names the clip (an element, a selection, a cache keyed by id) follows its left half, and an undo brings the whole clip back under the same id. Code that found the halves by looking for two new ids finds one: the left half is the clip with the original id.

`engine.dispose({ keepAdapter: true })` leaves the adapter undisposed, for a host that plays another arrangement on the same adapter next: it stops playback first (as `stop()` does), lets go of the arrangement and of the adapter's `onPlaybackEnded`, and a new `PlaylistEngine` can then be built with the same adapter. `dispose()` without options is unchanged.

`isArrangement(value)` is exported: true for an arrangement made by `createArrangement()` (of this copy of the package or another one with the same attach-key version), as the engine checks its `arrangement` option. `<daw-editor>`'s `editor.arrangement` setter uses it.
