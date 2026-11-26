---
'@waveform-playlist/browser': patch
---

A change to the arrangement made elsewhere while a clip or track drag is in progress (an app's or an agent's `arrangement.undo()`, `reorderTrack`, `removeTrack`) cancels the drag when it changed what is dragged: the dragged clip is gone or no longer where the drag started from, or the dragged track is gone or the track order changed (#848). The change goes through, and the release then changes nothing. A mix change, another clip loading or an edit of another clip let the drag go on.

A split now keeps the clip's id on its left half (`@waveform-playlist/engine`): the left `ClipView` stays mounted with its new length, as after a trim.
