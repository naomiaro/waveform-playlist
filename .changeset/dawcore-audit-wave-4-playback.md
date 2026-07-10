---
'@dawcore/components': patch
---

Correctness fixes from the dawcore audit (wave 4 — playback semantics and element wiring):

- `<daw-player>` survives DOM reparenting: a disconnect→reconnect cycle (framework re-render, list reorder, portal) previously left the player permanently dead — the engine was disposed on disconnect and nothing recreated the track. Reconnect now rebuilds the engine (preserving volume) and reloads the source.
- `<daw-player>`'s peaks-error path gained the same stale-request guard as its success path — a superseded `peaks-src` whose fetch failed late no longer settles readiness (firing `daw-ready` while the newer peaks were still loading) or clobbers the newer waveform.
- `<daw-player>.seekTo()` while paused now updates the playhead and dispatches `daw-timeupdate` — the rAF loop only runs while playing, so consumers (`<daw-time-display>`) previously stayed stale until the next play.
- `<daw-editor>.seekTo()` while playing dispatches `daw-seek` instead of spurious `daw-stop` + `daw-play` (consumers keyed on those misfired on every programmatic seek), updates `currentTime` synchronously, and no longer opens an async window where a user pause was overridden by the deferred play. Non-finite times are rejected and negative times clamped — `seekTo(NaN)` previously reached the adapter clock and wedged playback. `seekTo` while stopped also dispatches `daw-seek` now.
- `<daw-keyboard-shortcuts>`'s remap properties (`playbackShortcuts`, `splittingShortcuts`, `undoShortcuts`, `customShortcuts`) now invalidate the shortcut cache — assigning them after any keydown had warmed the cache was silently ignored.
- `<daw-play-button>` / `<daw-pause-button>` re-resolve their target on every render (the #573 fix that previously only reached the record button) — with an editor that upgrades after the buttons, Play now disables during recording and Pause pauses the recording instead of just the transport.
