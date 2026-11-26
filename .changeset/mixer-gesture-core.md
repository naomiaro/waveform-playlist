---
'@waveform-playlist/core': minor
---

core: `createMixerGesture()` (exported with the type `MixerGesture`) makes the gesture ids of one mixer control, so that a fader drag is one undo step of the arrangement's mixer setters (#843). It returns `id`, `end()`, and `attach(input)`, which ends the gesture on the input's `change` (the end of a pointer drag), on the `keyup` of a held arrow, Page Up/Down, Home or End key (a held key is one step), and on `blur`, and returns the function that removes its listeners. Use one per slider; ids are unique per helper, also across two installed copies of the package. Pass `{ gesture: gesture.id }` to the mixer setters of `@waveform-playlist/engine` (and of `useEditorControls()` in `@waveform-playlist/browser`). It lives in core, not the engine, so that `<daw-editor>`, which loads the engine with a dynamic `import()`, can use it without a static import of the engine.
