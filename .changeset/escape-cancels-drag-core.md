---
'@waveform-playlist/core': patch
---

`handleKeyboardEvent` ignores an Escape whose default was already prevented, so an Escape that cancelled a drag does not also stop playback or deselect (#848).
