---
'@waveform-playlist/browser': patch
---

`useKeyboardShortcuts` (and with it `<KeyboardShortcuts>` and `usePlaybackShortcuts`) runs the shortcuts of the last committed render. A key pressed right after a render that did not come from an event, such as the one in which a selection finishes playing, ran the previous render's shortcuts: Space then paused playback that had already ended instead of playing the selection again. The listener's copy of the shortcuts is now updated when the render commits instead of after paint.
