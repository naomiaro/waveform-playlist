---
'@dawcore/components': patch
---

Correctness fixes from the dawcore audit (wave 3 — effects):

- `exportAudio()` no longer retries failed-plugin placeholders: a saved chain containing a plugin that failed to restore previously either rejected the whole export (dead URL retried) or rendered an effect that was absent from live playback. Serialized placeholder entries now carry `placeholder: true` and export skips them, matching the live silent-passthrough; restore ignores the flag and retries normally.
- `setEffectsState()` with a failing native entry (e.g. an unregistered custom `registerEffect` type) no longer throws mid-restore after the old chain was already destroyed — the failed entry becomes a bypassed passthrough placeholder carrying its saved params (round-trips on re-serialize), `daw-effect-error` fires with the entry's `type`, and the remaining entries restore normally (same policy as failed WAM loads).
- Reopening a generic (fallback) effect parameter panel rebuilds it from the current parameter values — previously the cached panel showed the values from when it was first built, and the first slider drag snapped the audio back to the stale position after any API-side `setEffectParams`.
- `daw-effect-reorder` now reports the `toIndex` the chain actually used (clamped to the chain bounds) instead of the raw requested index.
- `exportAudio()` applies the engine master volume — previously a session mixed at `setMasterVolume(0.5)` exported 2× louder than live playback.
