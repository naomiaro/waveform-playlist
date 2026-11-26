---
'@dawcore/components': patch
---

`<daw-editor>`: undo and redo (`editor.undo()` / `redo()` and `<daw-keyboard-shortcuts undo>`) do nothing while a clip move, a clip trim or a track-reorder drag is in progress. Escape cancels a clip move, a clip trim, a track-reorder drag and an annotation edge drag, and does nothing else: it does not also stop playback. Disconnecting the editor in the middle of a drag cancels the drag (#848).
