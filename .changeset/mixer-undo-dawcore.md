---
'@dawcore/components': patch
---

dawcore: mixer moves are undo steps (#843).

- A volume, pan, mute or solo change is an undo step: one per `<daw-track-controls>` slider drag or key press, per Mute or Solo click, per `<daw-track>` property set or attribute change (mix changes made together in one synchronous run, before the next microtask, are one step) and per `editor.updateTrack()` call. Before, the mix was never an undo step. A track is in the arrangement while its audio loads (#848), so a change made then is a step too.
- `<daw-track-controls>` and `editor.tracks` show the arrangement's mix, so they follow Undo and Redo. The editor never writes a `<daw-track>`'s attributes; its `volume`, `pan`, `muted` and `soloed` properties read the arrangement's mix (#848), so they follow Undo and Redo too, and setting one is a request to the arrangement.
- `daw-track-update` detail gains `changed` (`DawTrackUpdateDetail`, exported: `{ trackId, changed }`), the properties of that update. It is an outbound notification: since #848 the editor acts on it only for `kind`, `render-mode`, `spectrogramConfig` and `src` (the mix and the name are asked for by the properties directly).
- `daw-track-control` detail gains `gesture?: string` (`DawTrackControlDetail`), the slider's gesture id; mute and solo send none.
- The take's mute: a take mutes the track it records onto through the engine (`engine.setTrackRecording`) in place of writing its mute. The track plays muted and its controls and `editor.tracks` show it muted for the take; the take creates no undo step, and a mute changed during the take stays after it (before, the end of the take wrote the mute from before it back). `<daw-track-controls>` has a property `recording` and disables its Mute button while it is true, so that track's M button does nothing during a take (as React's `<TrackMuteButton />`). The exported `RecordingSession` type (and the `ReadonlyRecordingSession` that `getSession()` returns) no longer has `armedPrevMuted`.
