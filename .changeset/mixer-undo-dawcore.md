---
'@dawcore/components': patch
---

dawcore: mixer moves are undo steps (#843).

- A volume, pan, mute or solo change is an undo step: one per `<daw-track-controls>` slider drag or key press, per Mute or Solo click, per `<daw-track>` attribute update (properties set in one synchronous run are one update) and per `editor.updateTrack()` call. Before, the mix was never an undo step. A change made while the track is still loading sets the values it enters with and is not a step.
- `<daw-track-controls>` and `editor.tracks` show the arrangement's mix, so they follow Undo and Redo. The editor does not write a `<daw-track>` element back after an Undo: the element keeps the value it was given.
- `daw-track-update` detail gains `changed` (`DawTrackUpdateDetail`, exported: `{ trackId, changed }`), the properties of that update; the editor sends only the mixer properties it names, so a rename after an Undo no longer sends the element's older volume back.
- `daw-track-control` detail gains `gesture?: string` (`DawTrackControlDetail`), the slider's gesture id; mute and solo send none.
- The recording arm: a take arms its track (`engine.setTrackArmed`) in place of writing its mute. The track plays muted and its controls and `editor.tracks` show it muted for the take; the take creates no undo step, and a mute changed during the take stays after it (before, the end of the take wrote the mute from before it back). The exported `RecordingSession` type (and the `ReadonlyRecordingSession` that `getSession()` returns) has `armed: boolean` in place of `armedPrevMuted: boolean | null`.

Known limit: every track load ends in `engine.setTracks`, which clears the undo history, mixer steps included (#848).
