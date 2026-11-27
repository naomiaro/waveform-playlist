---
'@waveform-playlist/core': major
'@waveform-playlist/browser': major
'@waveform-playlist/spectrogram': major
---

A track's render mode, spectrogram config and colour map are stored on the track, in the arrangement (#814). The track menu, `useTrack().setRenderMode` and the spectrogram settings dialog change the track's `renderMode`, `spectrogramConfig` and `spectrogramColorMap` with `arrangement.updateTrack`. `SpectrogramProvider` no longer keeps per-track overrides of its own.

- **Each choice is an undo step.** Undo puts the previous mode or settings back; like any edit, a choice clears the redo history. Choosing the mode a track already has changes nothing, and so does an Apply in the settings that changed nothing (it only closes the dialog).
- **An app's own change of the track applies.** A `renderMode` the app set with `arrangement.updateTrack` after a choice in the track menu used to be ignored for good: the provider's override won. Now the last change to the track is what is drawn.
- **The choices are in `arrangement.getTracks()`**, so an app that saves its tracks saves them. `arrangement.setTracks(…)` replaces them with the tracks it is given; before, a choice survived it by track id. A track added with the id of a removed one no longer inherits the removed track's choice.
- **Removed:** `trackSpectrogramOverrides` of `useSpectrogramIntegration()` (`@waveform-playlist/browser`) and the `TrackSpectrogramOverrides` type (`@waveform-playlist/core`). Read the track's fields instead. Migration: `website/docs/react/upgrading.md`, "Spectrogram choices are stored on the track".

The settings dialog's Apply changes only what the user changed, and calls no `onApply` when nothing was changed (a field set back to the value it had is no change):

- **The top frequency.** With no `maxFrequency` in the config, the field showed 20000 and Apply wrote it, so the top of the display dropped from 24 kHz to 20 kHz at 48 kHz. The field now shows half the sample rate of the provider's audio context, the default the spectrogram is drawn to, and Apply leaves `maxFrequency` unset unless it was typed. An emptied field goes back to the default. `<SpectrogramSettingsModal>` takes the rate as a new optional `sampleRate` prop (the integration's `SettingsModal` type has it too); without it the field is empty.
- **A custom colour map** (an array of colours) shows as "custom" and is kept, unless a named one is picked. It used to show as viridis and be replaced by it.
- **Fields the dialog does not show** (`alpha`, `labelsColor`, `labelsBackground`) are kept. Apply used to build the config from the dialog's ten fields and drop the others.
- **The Apply button** takes its colours from the theme's `buttonBackground`, `buttonText`, `buttonBorder` and `buttonHoverBackground`, instead of Docusaurus's `--ifm-color-primary` (with `#4a9` outside Docusaurus).
