---
'@waveform-playlist/core': patch
'@waveform-playlist/browser': patch
'@dawcore/components': patch
---

Refines the focused-control rule for keyboard shortcuts:

- A focused `<select>` keeps every key, however it got focus, so it works like any other dropdown (Space and the arrow keys open or change it). After picking a value with the mouse, click elsewhere or press Tab before using Space to play.
- The pointer exception for buttons, links, sliders and checkboxes covers Space only. `Enter` always goes to the focused control, so an Enter shortcut (playing the active annotation) no longer fires over a control the user just clicked.
