---
'@waveform-playlist/core': minor
'@waveform-playlist/browser': patch
'@dawcore/components': patch
---

Keyboard shortcuts no longer take a key that the focused control uses itself (#710). `handleKeyboardEvent` now skips a shortcut when:

- the focused element is an `<input>` of any type, a `<textarea>`, a `<select>` (new) or `contenteditable`;
- the key is `Escape` and a modal `<dialog>` or an `aria-modal="true"` container is open, so Escape closes the dialog instead of stopping playback. The spectrogram settings modal could not be closed from the keyboard;
- the key is `Space` or `Enter` and the focused element is a `<button>`, a link or a `<summary>`. Before, Space on a focused Mute button started playback and did not mute, so buttons could not be operated from the keyboard while shortcuts were on.

How the control got focus makes no difference: a control that was clicked still has focus. **After clicking a button such as Mute, Space now activates that button again instead of toggling playback**, and after picking a value from a dropdown, Space opens the dropdown. Space is play/pause when focus is not on a control. The React Play, Pause and Stop buttons are disabled when they do not apply, so focus leaves them on click and Space keeps working there; the dawcore transport buttons keep focus, so click Play then Space no longer pauses. Elements that only carry an ARIA role (`<div role="button">`) are not covered.

The check reads the real target from the event's composed path, so it also covers controls inside shadow DOM. In `<daw-editor>` the existing text-field check never saw the range inputs and buttons inside `<daw-track-controls>`. `<daw-annotation-track keyboard-controls>` applies the same rule to its own shortcuts.

New in `@waveform-playlist/core`: `keyBelongsToFocusedControl(event)`, the rule itself, for listeners that match keys on their own.
