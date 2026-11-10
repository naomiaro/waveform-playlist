---
'@dawcore/components': patch
'@waveform-playlist/ui-components': minor
'@waveform-playlist/browser': minor
---

Opt-in clip-gain waveform scaling: each clip's waveform is drawn scaled by its `gain` (clamped to the channel height), so clips levelled with clip gain look the way they sound. Draw-time only — peaks are not regenerated. Off by default (waveforms show source level, as before).

- `@dawcore/components`: `gain-scaled-waveforms` attribute on `<daw-editor>`.
- `@waveform-playlist/browser`: `gainScaledWaveforms` prop on `<Waveform>`; `ClipPeaks` carries the clip's `gain`.
- `@waveform-playlist/ui-components`: `gain` prop on `Channel` / `SmartChannel`.
