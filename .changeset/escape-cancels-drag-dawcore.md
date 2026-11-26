---
'@dawcore/components': patch
---

`<daw-editor>` (#848):

- Undo and redo (`editor.undo()` / `redo()` and `<daw-keyboard-shortcuts undo>`) do nothing while a clip move, a clip trim or a track-reorder drag is in progress. The drag does not change `canUndo` / `canRedo`.
- Escape cancels a clip move, a clip trim, a track-reorder drag and an annotation edge drag, and does nothing else: it does not also stop playback, and `<daw-annotation-track keyboard-controls>` does not deselect. A clip or annotation pressed but not yet moved is not a drag.
- A clip drag opens its undo transaction when the pointer passes the drag threshold, not at the press: an undo during a press no longer leaves the drag that follows as one undo step per pointer move.
- Disconnecting the editor in the middle of a drag or a press cancels it.
- New: `ClipPointerHandler.isDragging`.
