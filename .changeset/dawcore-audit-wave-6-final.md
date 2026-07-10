---
'@dawcore/components': patch
---

Correctness fixes from the dawcore audit (wave 6 — final):

- Reparenting `<daw-editor>` no longer leaves a half-alive editor: disconnect already disposed the engine (and the consumer's adapter through it) but retained the track/render state, so a reconnected editor showed ghost waveforms that could never play. Teardown is now symmetric, and rebuilding on the disposed adapter fails loudly with an actionable error (some adapters' dispose leaves the AudioContext open, so decode alone would silently succeed into a dead transport graph) until a fresh `editor.adapter` is set. Declarative and programmatic (`addTrack`) tracks re-register on reconnect; only file-dropped element-less content does not survive.
- Undoing a track removal no longer resurrects a ghost: the engine restores the track but the editor's descriptor was purged, leaving "Untitled" controls and a track missing from `editor.tracks` (unaddressable by per-track APIs). A descriptor is now synthesized from the engine track — and pruned again when redo removes the track (one-sided synthesis would strand a permanent ghost that `removeTrack()` can't clean).
- Toggling `mono` re-extracts peaks immediately — previously the stale channel layout persisted until the next zoom change, then snapped mid-session.
- Removing the last spectrogram track and adding a new one no longer renders black until a ≥100px scroll: the stale viewport cache is cleared when the spectrogram controller is disposed.
- `<daw-waveform>` bars straddling a 1000px chunk boundary are now drawn by both chunks — previously every boundary showed a 1–2px gap whenever `barWidth + barGap` didn't divide 1000.
- Files rejected for a non-audio MIME type now dispatch `daw-files-load-error` like decode failures — the drop is no longer silently swallowed for apps using the documented event surface.
