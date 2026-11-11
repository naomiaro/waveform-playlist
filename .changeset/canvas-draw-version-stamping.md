---
'@waveform-playlist/ui-components': patch
---

`PianoRollChannel` and `TimeScale` no longer clear and redraw every mounted canvas chunk when the set of visible chunks changes while scrolling. Like `Channel`, each canvas is stamped with the parameters it was drawn with and skipped while they are current, so only newly mounted chunks are drawn. `TimeScale` finds each chunk's ticks with a binary search instead of scanning every tick of the timeline, a piano-roll channel without notes no longer redraws on every render, and passing an inline `renderTick` to `SmartScale` (or `renderTick` to `<Waveform>`) re-renders the labels without redrawing the tick canvases. As with `Channel`, the notes array and tick map must be replaced rather than mutated in place for a change to be drawn.
