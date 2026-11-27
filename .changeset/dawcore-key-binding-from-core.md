---
'@dawcore/components': patch
---

`KeyBinding` is no longer exported by `@dawcore/components` (#807). It was a second declaration of `@waveform-playlist/core`'s `KeyBinding`, the same `Pick<KeyboardShortcut, 'key' | 'ctrlKey' | 'shiftKey' | 'metaKey' | 'altKey'>`; import it from `@waveform-playlist/core`, a peer dependency of `@dawcore/components`. `PlaybackShortcutMap`, `SplittingShortcutMap` and `UndoShortcutMap` are unchanged and take the same bindings.
