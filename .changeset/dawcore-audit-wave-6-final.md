---
'@dawcore/components': patch
---

Correctness fixes from the dawcore audit (wave 6 — final):

- Reparenting `<daw-editor>` no longer leaves a half-alive editor: disconnect already disposed the engine and clip caches but retained the track/render state, so a reconnected editor showed ghost waveforms that could never play. Teardown is now symmetric — element-backed tracks re-register and reload on reconnect (failing loudly via `daw-track-error` if the disposed adapter can't decode); element-less content does not survive a reparent (documented).
- Undoing a track removal no longer resurrects a ghost: the engine restores the track but the editor's descriptor was purged, leaving "Untitled" controls and a track missing from `editor.tracks` (unaddressable by per-track APIs). A descriptor is now synthesized from the engine track.
- Toggling `mono` re-extracts peaks immediately — previously the stale channel layout persisted until the next zoom change, then snapped mid-session.
- Removing the last spectrogram track and adding a new one no longer renders black until a ≥100px scroll: the stale viewport cache is cleared when the spectrogram controller is disposed.
- `<daw-waveform>` bars straddling a 1000px chunk boundary are now drawn by both chunks — previously every boundary showed a 1–2px gap whenever `barWidth + barGap` didn't divide 1000.
- Files rejected for a non-audio MIME type now dispatch `daw-files-load-error` like decode failures — the drop is no longer silently swallowed for apps using the documented event surface.
