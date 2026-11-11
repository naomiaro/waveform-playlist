---
'@waveform-playlist/core': patch
'@waveform-playlist/browser': patch
'@dawcore/components': patch
---

Refines the focused-control rule for keyboard shortcuts:

- A `<select>` dropdown that was used with the pointer no longer blocks the Space shortcut. Picking a time format and then pressing Space plays again. A dropdown reached with Tab keeps every key, and so does a list box (`multiple` or `size` > 1).
- The pointer exception now covers Space only. `Enter` always goes to the focused button, link, dropdown, slider or checkbox, however it got focus, so an Enter shortcut (playing the active annotation) no longer fires over a control the user just clicked.
