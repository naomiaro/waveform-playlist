---
'@waveform-playlist/browser': major
'@waveform-playlist/annotations': patch
'@waveform-playlist/ui-components': patch
---

The annotation UI is two parts that own their options, the same under both providers, and the annotation options have one home.

- `WaveformAnnotationBoxes` (`getLabel`, `height`) is the row of annotation boxes under `WaveformRoot` and `MediaElementWaveformRoot`. It wires the drag of its edges itself.
- New `AnnotationList` (`height`, `actions`, `scrollActivePosition` with `'none'`, `scrollActiveContainer`, a function child for a row) is the text list, anywhere under either provider. A click on a row plays the annotation. It draws nothing without annotations, and nothing (one development warning) without `<AnnotationProvider>`.
- New `useAnnotationOptions()`: `{ editable, linkEndpoints, continuousPlay }` under both providers. `setAnnotationsEditable` and `setLinkEndpoints` are on `usePlaybackControls()`. `annotationList` takes `editable` and `linkEndpoints` under `MediaElementPlaylistProvider` too, and the options follow the prop when a field changes. `ContinuousPlayCheckbox`, `LinkEndpointsCheckbox` and `EditableCheckbox` work under both providers.
- `<Waveform />`, `<WaveformEditor />` and `<MediaElementWaveform />` take `className` only.

Removed: the annotation props of the three ready-made views; `MediaElementAnnotationBoxes`, `PlaylistAnnotationList`, `MediaElementAnnotationList`; `annotationListConfig`; every `onAnnotationUpdate` (the provider's `onAnnotationsChange` is the one report) and `OnAnnotationUpdateFn`; `useAnnotationEditing()`; `continuousPlay` in `useAnnotations()`; the two setters on `useEditorControls()`; the unread `annotationList.controls`. See the upgrade guide.

`annotations`: the three checkboxes generate their ids; a click on a default row of `AnnotationText` in a field that is being edited does not choose the annotation; the colour of the active row is the theme's `annotationTextItemActiveColor`.

`ui-components`: new theme key `annotationTextItemActiveColor` (`#ff9800`); the dark default of `annotationBoxBorder`, which is read now, is `#ff9800`.
