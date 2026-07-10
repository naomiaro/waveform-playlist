---
'@dawcore/components': patch
---

Correctness fixes from the dawcore audit (wave 5 — zoom-floor and beats-mode math):

- The zoom floor now covers worker-generated peaks (cached at the pipeline base scale, 128), not just pre-computed `.dat` data — previously `<daw-editor samples-per-pixel="32">` (or zooming in past 128) rendered every worker-peaked waveform squeezed into a fraction of its clip container, misaligned against the ruler and playhead, and the allowable zoom range silently changed after deleting a track.
- Raising the zoom floor re-clamps the live `samplesPerPixel` — previously a `.dat` at a coarser scale than the current zoom left layout at the finer spp while peaks clamped to the coarser scale (half-width waveforms until the consumer next touched the zoom).
- Recorded clips generate their finalized peaks at the render-space samples-per-pixel (tick-derived in beats mode) instead of the temporal scale, and populate the clip-offsets cache — fixing wrong-width recorded waveforms in beats mode and a redundant full worker pass after every recording.
- The live recording preview in beats mode is positioned with the same tick-space math as finalized clips — the take no longer jumps sideways the moment recording stops (the drift grew with distance from the timeline origin).
