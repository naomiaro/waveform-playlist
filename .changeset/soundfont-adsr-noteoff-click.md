---
'@waveform-playlist/playout': patch
---

Fix the confirmed audible click on staccato SoundFont notes with long-decay patches: the volume envelope is now truncated at note-off (each AHD phase clipped, ending with a partial ramp to the analytically-computed envelope value) instead of scheduling the full envelope and stepping to sustain. Previously the gain held at PEAK for the whole staccato note — the decay ramp's endpoint sorted after note-off and never governed — then stepped peak→sustain in a single sample (0.576 measured at velocity 0.8; verified via Chromium OfflineAudioContext gain-curve capture). Notes that outlive the decay are scheduled identically to before; the fix is cross-browser (no `cancelAndHoldAtTime`).
