---
'@dawcore/components': patch
---

`daw-clip-split` after a split at the playhead: `leftClipId` is now the same as `originalClipId` (#848). The engine keeps a split clip's id on its left half; `rightClipId` is the one new clip.
