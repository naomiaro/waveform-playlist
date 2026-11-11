---
'@waveform-playlist/core': patch
'@waveform-playlist/browser': patch
---

Annotations, link endpoints: two edges that are closer than 10 ms count as linked, and a linked neighbour's edge now takes the dragged edge's position exactly. Before, it was moved by the same amount as the dragged edge, so a gap smaller than 10 ms was carried along for the rest of the drag and never closed. This happened when two separated annotations were dragged into each other with link endpoints on and a pointer move landed just short of the neighbour (about half of such drags at the default zoom): the boxes looked joined, but the end of one and the start of the next differed by a few milliseconds.

The fix is in core's `updateAnnotationBoundaries`, which the dawcore annotation track and `@waveform-playlist/annotations` use. The browser package's `useAnnotationDragHandlers` had a private copy of the same logic and now calls core's function.
