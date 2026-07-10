---
'@dawcore/components': patch
---

Correctness fixes from the dawcore audit (wave 2 — editor lifecycle and timeline):

- A track removed while its clips are still loading is no longer resurrected into the engine and timeline when the load completes (including the peaks-first preview, which previously reappeared for the whole audio decode); the load's cache writes and zoom-floor raise are rolled back. Cancelled loads reject with a `TrackLoadCancelledError` and dispatch `daw-track-error` with a new `detail.reason: 'removed' | 'disconnected'` so consumer error UIs can filter intentional cancellations from real failures.
- `addTrack()`/`loadMidi()` promises no longer hang forever when a track load fails — or completes — after the editor was detached: the error dispatches regardless of connectivity so awaiters settle, and a successful decode on a detached editor is cancelled instead of rebuilding an engine that nothing will ever dispose.
- `addClip()` called while the parent track is still loading now rejects with actionable guidance instead of hanging forever — including during a peaks-first load, where it previously resolved and then silently discarded the clip when the final track commit overwrote the render-only preview.
- A single peaks-worker crash no longer poisons peak generation for the editor's lifetime — the pipeline detects the crashed worker and spawns a fresh one on the next request.
- Splitting a clip during playback no longer leaks a backward-jumping `daw-timeupdate` (30→0→30) from the internal stop/play cycle — the split path now uses the same seek-transition suppression as `seekTo`.
- Removing the last track now rewinds the engine to 0 (previously the display showed 0 while the next `play()` resumed from the stale engine position) and stops a still-playing engine — dispatching `daw-stop` like every other stop path — instead of stranding `isPlaying` with a dead playhead loop. Never-registered `<daw-track>` element churn no longer rewinds the cursor on an empty timeline.
