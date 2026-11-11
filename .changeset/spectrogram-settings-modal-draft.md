---
'@waveform-playlist/spectrogram': patch
'@waveform-playlist/browser': patch
---

The spectrogram settings modal no longer discards unapplied edits when the playlist re-renders. On a track with no spectrogram config at any level, any re-render (playback starting or stopping, a zoom step) reset the open form to its defaults. The form is now a draft created each time the dialog opens: it starts from the current settings on open, a cancelled edit is gone on the next open, and nothing overwrites it while it is open. The modal's controls are also associated with their labels, the dialog is named by its title, and the native `close` listener is attached once instead of on every parent render.
