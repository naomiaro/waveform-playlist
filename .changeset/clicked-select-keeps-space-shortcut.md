---
'@waveform-playlist/core': patch
'@waveform-playlist/browser': patch
'@dawcore/components': patch
---

A `<select>` that was used with the pointer no longer blocks the Space and Enter shortcuts. Picking a time format from the dropdown and then pressing Space plays again, as it did before the focused-control rule was added; the dropdown still keeps its other keys (Escape, arrows, typing), and keeps every key when it was reached with Tab. This is the same exception buttons and sliders already had.
