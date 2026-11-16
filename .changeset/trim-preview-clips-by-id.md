---
'@waveform-playlist/browser': major
'@waveform-playlist/ui-components': minor
'@waveform-playlist/spectrogram': patch
'@waveform-playlist/core': minor
---

A clip trim now previews in the view and changes the tracks once, on release. While a trim handle is dragged, the tracks do not change (each move asks the arrangement for the allowed delta, which changes nothing); the dragged clip is drawn at the previewed start, length and offset (with the waveform for that slice), and only that clip's view follows the pointer. On release the handler makes one `arrangement.trimClip()`, as a clip move makes one `moveClip()`. A trim is one undo step, and Escape clears the preview and changes nothing. The preview is internal: there is no hook to read or write it. Before, the tracks changed on every pointer move of a trim (#812).

Breaking:

- `useEngineRefs().isDraggingRef` is removed, with no replacement. An app with its own trim gesture keeps the gesture in its own state and makes one `arrangement.trimClip()` on release.
- `useClipDragHandlers` no longer takes `onTracksChange` or `isDraggingRef` (its options are `samplesPerPixel` and `snapSamplePosition`: see the changeset of the provider's `arrangement` prop). A move and a trim are one call each and no longer open a transaction.
- `useClipSplitting().splitClipAt` takes `(trackId, clipId, splitTime)` instead of `(trackIndex, clipIndex, splitTime)`; an unknown id returns `false`. The clip drags (`useClipDragHandlers`, `ClipCollisionModifier`) find a clip by its `clipId`, and `clipIndex` of the drag data is no longer read.

Also visible:

- A trimmed edge stops at a neighbouring clip during the drag (each move is constrained after snapping); before, the constraint was applied on release only. The committed result is the same.
- While a trim is dragged past the end of the timeline, the view is as wide as the previewed end rounded up to the next 10 seconds; after the release it is the exact new duration.
- A spectrogram follows the trim: during the drag, after the release and after Escape. A spectrogram canvas registers with the range of the audio it is drawn for: `SpectrogramCanvasRegistration` (core) has optional `offsetSamples` and `durationSamples`, `SpectrogramChannel` takes them as optional props (and `SmartChannel` as `spectrogramOffsetSamples` / `spectrogramDurationSamples`) and mounts new canvases when they change, and `SpectrogramProvider` draws each clip for the range its canvases registered with, or the clip's own when a registration has none. The view's canvases register with the range they are drawn for, so a change of the range at the same pixel width (a sub-pixel trim, an undo of one) now redraws too; before, only a change of the width did.
- A trim follows the track it started on, by id, if the track's row changes during the drag (a reorder). A clip move whose `clipId` is not in the track is dropped with a console warning.
