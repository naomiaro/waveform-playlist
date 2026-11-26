---
'@waveform-playlist/core': patch
---

`handleKeyboardEvent` ignores an Escape whose default something other than a shortcut list already prevented (#848). dnd-kit and `<daw-editor>` prevent it when they cancel a drag, so an Escape that cancelled a drag does not also stop playback or deselect; an app's own `preventDefault()` on Escape, made before the library's listener runs, switches those off the same way. Two shortcut lists that both bind Escape both run, as before.
