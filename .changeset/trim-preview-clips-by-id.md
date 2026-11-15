---
'@waveform-playlist/browser': major
'@waveform-playlist/ui-components': minor
'@waveform-playlist/spectrogram': patch
'@waveform-playlist/core': minor
---

A clip trim now previews in the view and changes the tracks once, on release. While a trim handle is dragged, the tracks do not change: `onTracksChange` and `engine.trimClip()` are not called until the release (with an engine attached, each move asks `engine.constrainTrimDelta`, which changes nothing); the dragged clip is drawn at the previewed start, length and offset (with the waveform for that slice), and only that clip's view follows the pointer. On release the handler makes one `engine.trimClip()` and the provider calls `onTracksChange` once, as for a clip move. A trim is one undo step, and Escape clears the preview and changes nothing. The preview is internal: there is no hook to read or write it. Before, `onTracksChange` was called on every pointer move of a trim (#812).

Breaking:

- `useEngineRefs().isDraggingRef` is removed, with no replacement. The provider no longer skips a `tracks` change while a trim is dragged; an app with its own trim gesture that calls `onTracksChange` on every move now gives the provider an ordinary `tracks` change for each one.
- `useClipDragHandlers` no longer takes `onTracksChange` or `isDraggingRef`; its options are `tracks`, `samplesPerPixel`, `engineRef` and `snapSamplePosition`. A move and a trim are one engine call each and no longer open an engine transaction.
- `useClipSplitting().splitClipAt` takes `(trackId, clipId, splitTime)` instead of `(trackIndex, clipIndex, splitTime)`; an unknown id returns `false`. The clip drags (`useClipDragHandlers`, `ClipCollisionModifier`) find a clip by its `clipId`, and `clipIndex` of the drag data is no longer read.

Also visible:

- With an engine attached, a trimmed edge stops at a neighbouring clip during the drag (each move is constrained by `engine.constrainTrimDelta`, after snapping); before, the constraint was applied on release only. The committed result is the same.
- While a trim is dragged past the end of the timeline, the view is as wide as the previewed end rounded up to the next 10 seconds; after the release it is the exact new duration.
- A spectrogram follows the trim: during the drag, after the release and after Escape. A spectrogram canvas registers with the range of the audio it is drawn for: `SpectrogramCanvasRegistration` (core) has optional `offsetSamples` and `durationSamples`, `SpectrogramChannel` takes them as optional props (and `SmartChannel` as `spectrogramOffsetSamples` / `spectrogramDurationSamples`) and mounts new canvases when they change, and `SpectrogramProvider` draws each clip for the range its canvases registered with, or the clip's own when a registration has none. The view's canvases register with the range they are drawn for, so a change of the range at the same pixel width (a sub-pixel trim, an undo of one) now redraws too; before, only a change of the width did.
- A trim follows the track it started on, by id, if the track's row changes during the drag (a reorder). A clip move whose `clipId` is not in the track is dropped with a console warning, and `engine.moveClip()` is not called.
- A trim, a move or a split made while no engine is attached (before the first build has finished, or while the provider rebuilds after a `tracks` change that did not come from the engine) is dropped with a console warning, and the clip stays where it was.
