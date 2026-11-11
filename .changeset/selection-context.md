---
'@waveform-playlist/browser': major
---

`selectionStart` and `selectionEnd` move from `usePlaylistState()` to a new `useSelection()` hook, backed by their own context. They are the only playlist state that changes on every pointer move of a selection drag; while they were part of the state value, every component that called `usePlaylistState()` for any field re-rendered on every move.

Breaking: `usePlaylistState()` no longer returns `selectionStart` or `selectionEnd`. Read them from `useSelection()`. `setSelection` stays on `usePlaylistControls()`. `MediaElementPlaylistProvider` is unchanged (its selection is local to `MediaElementPlaylist`).

Measured per pointer move of a rightward selection drag, development build, fiber-walk probe: on the multi-clip example 31 components before and 9 after; on the annotations example (15 annotations, where the annotation list, the annotation boxes and the page's own component all read `annotations` from the state hook) 369 before and 17 after, and React render time at 4x CPU throttle from 19.8 ms to 1.5 ms. A leftward drag also moves the cursor, which goes through `usePlaybackAnimation()`; that path is not changed here (multi-clip 63 to 54 components, annotations 371 to 370).

Fixed: dragging a selection from right to left now selects the whole dragged range. The handler took its anchor from `selectionStart`, which stops being the anchor once the pointer passes to the left of it, so the range collapsed to the last pointer movement. The anchor is now the pointer-down position, kept in a ref, and `PlaylistVisualization` no longer subscribes to the selection.
