---
'@waveform-playlist/browser': patch
---

Undo and redo (`useEditorControls().undo` / `redo`, `<KeyboardShortcuts undo />`) do nothing while a clip move, a clip trim or a track-reorder drag is in progress. Before, an undo in the middle of a drag landed the clip away from the pointer, and one in the middle of a track drag left the control panels' DOM (tab) order out of step with the screen (#848, #906).
