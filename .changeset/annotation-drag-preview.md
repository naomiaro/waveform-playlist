---
'@waveform-playlist/browser': major
'@waveform-playlist/annotations': patch
---

Dragging an annotation edge no longer has to go through your state on every pointer move. Both providers have an `annotationPreview` source in their controls; pass it to `useAnnotationDragHandlers({ preview })` and each move is published there while `onAnnotationsChange` is called once, on release. The built-in annotation boxes and lists follow the preview, and `useAnnotationsWithPreview` does the same for a custom renderer. `MediaElementWaveform`'s boxes always drag this way, so its `onAnnotationsChange` is now called once per drag, not once per move (breaking if you relied on the per-move calls). On the annotations example a move re-rendered 312 components before and 47 after.

Escape during an edge drag restores every annotation the drag moved (a linked or pushed neighbour used to stay moved).

The annotation list's edit and control handlers no longer change when the annotations do, so a change to one annotation renders one row.
