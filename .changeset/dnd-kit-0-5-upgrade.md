---
'@waveform-playlist/browser': major
'@waveform-playlist/ui-components': major
'@waveform-playlist/annotations': major
---

Upgrade `@dnd-kit/*` peer dependencies from `^0.3.0` to `^0.5.0` (latest stable only; 0.x minors are breaking upstream).

- `@dnd-kit` 0.5 removed the top-level `feedback` option from `useDraggable`/`useSortable`. `Clip`, `AnnotationBox`, and `SortableTrackControls` now declare their Feedback settings per-entity via `plugins: [Feedback.configure(...)]` (clip-move `dropAnimation: null`, trim/edge handles `'none'`, track sortable `'move'`), so they work inside any `DragDropProvider` with no `plugins` prop.
- **Removed** `noDropAnimationPlugins` from `@waveform-playlist/browser`. In 0.5, any entity carrying its own Feedback config resets provider-level Feedback options, so the helper could not work reliably; drop `plugins={noDropAnimationPlugins}` from custom `DragDropProvider` setups.
- `@dnd-kit/dom` is now a declared peer of `@waveform-playlist/ui-components` (optional) and `@waveform-playlist/annotations`.
- `DragStartEvent`/`DragMoveEvent`/`DragEndEvent` are event object types in 0.5 (not handler types); handler hooks type their parameters with them directly.
