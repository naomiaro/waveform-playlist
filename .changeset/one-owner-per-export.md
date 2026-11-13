---
'@waveform-playlist/annotations': major
'@waveform-playlist/browser': major
'@waveform-playlist/ui-components': major
'@waveform-playlist/spectrogram': major
'@waveform-playlist/core': major
---

A name is exported by one package (#770). `browser`, `annotations`, `ui-components`, `spectrogram` and `recording` re-export nothing from another package. The only names two entry points share are `AutomaticScrollCheckbox`, `MasterVolumeControl`, `PlaybackRateSelect`, `SelectionTimeInputs` and `TimeFormatSelect`: the one in `ui-components` is driven by props, the one in `browser` reads the provider and renders it. (`Track` is two different things under one name: a type in `@waveform-playlist/core` and a component in `@waveform-playlist/ui-components`.) Removed names have no shim and do not throw: a leftover import is `undefined` at runtime and a TypeScript error. The upgrade guide has the find-and-replace table.

`@waveform-playlist/annotations`:

- `ContinuousPlayCheckbox`, `LinkEndpointsCheckbox`, `EditableCheckbox` and `DownloadAnnotationsButton` are bound to the playlist provider here (they read browser's `useAnnotationOptions()`, `usePlaybackControls()` and `useAnnotations()`). They work under either provider and do not need `<AnnotationProvider>`; without a playlist provider they throw the provider hook's message. The checkboxes take `className` and `children` (the label); their props type is `AnnotationCheckboxProps`. The button takes `filename`, `disabled`, `className`, `children` (the label, default "Download JSON") and `title` (the tooltip; left out, the two English defaults). Every string the four draw can be supplied by the app.
- **Removed:** the controlled forms of these four names (`checked` / `onChange`; `annotations` on the button) and the types `ContinuousPlayCheckboxProps`, `LinkEndpointsCheckboxProps`, `EditableCheckboxProps`. Old controlled code under a provider: the props are ignored and the control shows and sets the provider's option. For a controlled checkbox use `BaseCheckboxWrapper`, `BaseCheckbox`, `BaseCheckboxLabel` of `@waveform-playlist/ui-components`; for a download without a provider, `annotations.map(serializeAeneas)`.
- **Removed:** `AnnotationsTrack`, `AnnotationsTrackProps` (use `AnnotationBoxesWrapper` with `height={100}`; the wrapper also has `z-index: 110`); `useAnnotationControls`, `UseAnnotationControlsOptions`, `UseAnnotationControlsReturn`, `AnnotationUpdateParams` (under a provider `useAnnotationOptions()` and the setters of `usePlaybackControls()`; without one, your own state, with `linkEndpoints` starting `true` as the hook's did, and `updateAnnotationBoundaries` of `@waveform-playlist/core`); `Annotation`, `AnnotationProps` (no one-to-one replacement: `AnnotationBox` for the box, browser's `AnnotationList` for text and editing).

`@waveform-playlist/browser`:

- **Removed:** `ContinuousPlayCheckbox`, `LinkEndpointsCheckbox`, `EditableCheckbox`, `DownloadAnnotationsButton` (import them from `@waveform-playlist/annotations`), and the four control entries of `AnnotationIntegration`, which is now `parseAeneas`, `serializeAeneas`, `AnnotationText`, `AnnotationBox`, `AnnotationBoxesWrapper`.
- **No longer re-exported:** `ClipTrack`, `AudioClip`, `Fade`, `AnnotationData` (from `@waveform-playlist/core`); `TimeFormat` (from `@waveform-playlist/ui-components`); `EffectsFunction`, `TrackEffectsFunction` (from `@waveform-playlist/playout`); `SpectrogramCanvasRegistration` (from `@waveform-playlist/core`); `getShortcutLabel` (removed, see core).

`@waveform-playlist/ui-components`:

- **Removed:** `TrackControlsContext` and `useTrackControls` (nothing provided or read the context); `samplesToSeconds`, `secondsToSamples`, `samplesToPixels`, `pixelsToSamples`, `pixelsToSeconds`, `secondsToPixels` (copies of core's: import them from `@waveform-playlist/core`); the controlled `AudioPosition` and `AudioPositionProps` (browser's `AudioPosition` is the one); `SpectrogramCanvasRegistration` (from `@waveform-playlist/core`).
- **Changed:** `AutomaticScrollCheckbox`, `MasterVolumeControl` and `SelectionTimeInputs` generate their element ids with `useId()`. They had the fixed ids `automatic-scroll`, `master-gain`, `audio_start` and `audio_end`, so two of one control on a page shared an id. The input classes are unchanged; a `#master-gain` selector of your own no longer matches.
- **Renamed:** `SnapTo` is `BeatsAndBarsSnapTo` (`'bar' | 'beat' | 'off'`). Core's `SnapTo`, a longer list used by the web components, is unchanged.

`@waveform-playlist/spectrogram`: `TrackMenuItem` is no longer exported; the type is `TrackMenuItem` of `@waveform-playlist/ui-components` (the `items` of `TrackMenu`).

`@waveform-playlist/core`:

- **Removed:** `getShortcutLabel`. It built an English-only label (`Cmd` / `Ctrl`, `Option` / `Alt`, `Shift`, the upper-cased key; the Space key came out as a blank) and nothing in the library called it. Build the label from the shortcut's fields (`key`, `metaKey`, `ctrlKey`, `altKey`, `shiftKey`) with the app's own strings. `KeyboardShortcut` and `handleKeyboardEvent` stay.
- **Added:** the type `SpectrogramCanvasRegistration`, declared here once for ui-components, browser and spectrogram.
