---
'@waveform-playlist/browser': minor
---

Drag handlers, drag modifiers and the keyboard listener keep their identity instead of being rebuilt on every edit:

- `useClipDragHandlers` returns the same `onDragStart` / `onDragMove` / `onDragEnd` while the tracks change. An edit used to re-create all three handlers and hand them to `DragDropProvider`, also in the middle of a drag.
- `ClipCollisionModifier.configure()` accepts `tracks` as a function returning the current tracks, as well as an array. `ClipInteractionProvider` uses it so its `modifiers` array is no longer rebuilt when tracks change.
- A track's clips are sorted once per drag instead of on every pointer move, for both moves and trims.
- `useKeyboardShortcuts` subscribes to `keydown` once and reads the latest shortcuts when a key is pressed, instead of removing and re-adding the window listener whenever the `shortcuts` array is a new object.
