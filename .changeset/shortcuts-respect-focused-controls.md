---
'@waveform-playlist/core': minor
'@waveform-playlist/browser': patch
'@dawcore/components': patch
---

Keyboard shortcuts no longer take a key that the focused control uses itself (#710). `handleKeyboardEvent` now skips a shortcut when:

- the focused element is a text field, a `<select>` or `contenteditable` (`<select>` is new);
- the key is `Escape` and focus is inside an open modal `<dialog>` or an `aria-modal="true"` container, so Escape closes the dialog instead of stopping playback. The spectrogram settings modal could not be closed from the keyboard;
- the key is `Space` or `Enter` and the focused element is a button, link or similar control, unless it got focus from a pointer click. Before, Space on a Mute button reached with Tab started playback and did not mute. After clicking a button, Space is still play/pause.

The check reads the real target from the event's composed path, so it also covers controls inside shadow DOM. In `<daw-editor>` the existing text-field check never saw the range inputs and buttons inside `<daw-track-controls>`, and shortcuts fired while they had focus.

New in `@waveform-playlist/core`: `observeFocusSource(document)` records whether focus arrived by pointer or keyboard (it returns a function that stops it). `useKeyboardShortcuts` and `<daw-keyboard-shortcuts>` start it themselves. If you call `handleKeyboardEvent` directly, call it once when you set up your listener; without it a focused button always keeps Space and Enter.
