---
'@waveform-playlist/core': minor
'@waveform-playlist/browser': patch
'@dawcore/components': patch
---

Keyboard shortcuts no longer take a key that the focused control uses itself (#710). `handleKeyboardEvent` now skips a shortcut when:

- the focused element is a text field or `contenteditable`, or a `<select>` (new), slider or checkbox;
- the key is `Escape` and a modal `<dialog>` or an `aria-modal="true"` container is open, so Escape closes the dialog instead of stopping playback. The spectrogram settings modal could not be closed from the keyboard;
- the key is `Space` or `Enter` and the focused element is a `<button>`, a link or a `<summary>` that the user reached with the keyboard. Before, Space on a Mute button reached with Tab started playback and did not mute.

One exception, for `Space` only: a control that got focus from a pointer click or drag does not keep it. After clicking a button or dragging a volume slider, Space is still play/pause. Dropdowns are not part of this exception: a focused `<select>` keeps every key. `Enter` always goes to the focused control. For sliders and checkboxes this is new in the React packages, where a clicked slider used to block Space. Elements that only carry an ARIA role (`<div role="button">`) are not covered.

The check reads the real target from the event's composed path, so it also covers controls inside shadow DOM. In `<daw-editor>` the existing text-field check never saw the range inputs and buttons inside `<daw-track-controls>`, and shortcuts fired while they had keyboard focus. `<daw-annotation-track keyboard-controls>` applies the same rule to its own shortcuts.

New in `@waveform-playlist/core`:

- `observeFocusSource(document)` records whether focus arrived by pointer or keyboard (it returns a function that stops it). `useKeyboardShortcuts`, `<daw-keyboard-shortcuts>` and `<daw-annotation-track>` start it themselves. If you call `handleKeyboardEvent` directly, call it once when you set up your listener; without it a focused button always keeps Space and Enter.
- `keyBelongsToFocusedControl(event)`, the rule itself, for listeners that match keys on their own.
