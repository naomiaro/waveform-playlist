---
'@waveform-playlist/browser': patch
---

Space and the Play button act on the last committed render. A press right after a render that did not come from an event, such as the one in which a selection finishes playing, used the render before: Space (`useKeyboardShortcuts`, and with it `<KeyboardShortcuts>` and `usePlaybackShortcuts`) ran the previous shortcuts and paused playback that had already ended instead of playing the selection again, and Space and the Play button (`usePlayFromSelectionOrCursor`) could play the previous selection, or ignore looping just turned on. Both now take their copy of the shortcuts, the selection and the loop state when the render commits instead of after paint.
