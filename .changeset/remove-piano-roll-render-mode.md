---
'@waveform-playlist/core': major
'@waveform-playlist/ui-components': major
'@waveform-playlist/browser': major
'@dawcore/components': patch
---

`'piano-roll'` is removed from `RenderMode`. A piano roll is how a MIDI track (`kind: 'midi'`) is drawn, not a mode to choose; render modes apply to audio tracks.

**Breaking:**

- `@waveform-playlist/core`: `RenderMode` is `'waveform' | 'spectrogram' | 'both'`.
- `@waveform-playlist/ui-components`: `SmartChannel` draws a piano roll when it is given `midiNotes` (an empty array included) and ignores `renderMode` for that clip. `renderMode="piano-roll"` is gone, and a missing `midiNotes` now means an audio clip (it used to be drawn as an empty piano roll in piano-roll mode). `PianoRollChannel`'s wrapper carries `data-piano-roll`.
- `@waveform-playlist/browser`: a `renderMode` or a spectrogram override on a MIDI track does nothing.
- `@dawcore/components`: `render-mode="piano-roll"` is not a value any more; it logs a warning that names `kind="midi"` and is treated as `waveform`. `TrackDescriptor.renderMode` of a MIDI track is `'waveform'`; use `kind`.

Migration: `website/docs/react/upgrading.md`, "`'piano-roll'` is removed from `RenderMode`".
