---
'@waveform-playlist/browser': major
'@waveform-playlist/annotations': patch
---

Dragging an annotation edge no longer changes the annotations on every pointer move. Both providers have an `annotationPreview` source in their controls; pass it to `useAnnotationDragHandlers({ preview })` and each move is published there while the annotations change once, on release (a write to the annotation store, see the annotation store entry). The built-in annotation boxes and lists follow the preview, and `useAnnotationsWithPreview` does the same for a custom renderer. The MediaElement player's boxes always drag this way, so its annotations now change once per drag, not once per move (breaking if you relied on the per-move changes). On the annotations example a move re-rendered 312 components before and 47 after.

Escape during an edge drag restores every annotation the drag moved (a linked or pushed neighbour used to stay moved).

The annotation list's edit and control handlers no longer change when the annotations do, so a change to one annotation renders one row.
