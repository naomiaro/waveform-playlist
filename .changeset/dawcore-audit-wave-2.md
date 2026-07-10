---
'@dawcore/components': patch
---

Correctness fixes from the dawcore audit (wave 2 — editor lifecycle and timeline):

- A track removed while its clips are still loading is no longer resurrected into the engine and timeline when the load completes; the `addTrack()` promise rejects and the load's cache writes are purged.
- `addTrack()`/`loadMidi()` promises no longer hang forever when a track load fails after the editor was detached — `daw-track-error` dispatches regardless of connectivity so awaiters settle.
- `addClip()` called while the parent track is still loading now rejects with actionable guidance instead of hanging forever (the clip was never going to load — the track's clip list is snapshotted at connect time).
- A single peaks-worker crash no longer poisons peak generation for the editor's lifetime — the pipeline detects the crashed worker and spawns a fresh one on the next request.
- Splitting a clip during playback no longer leaks a backward-jumping `daw-timeupdate` (30→0→30) from the internal stop/play cycle — the split path now uses the same seek-transition suppression as `seekTo`.
- Removing the last track now rewinds the engine to 0 (previously the display showed 0 while the next `play()` resumed from the stale engine position) and stops a still-playing engine instead of stranding `isPlaying` with a dead playhead loop.
