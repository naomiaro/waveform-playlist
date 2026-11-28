---
'@waveform-playlist/browser': major
---

**Breaking: the WAV export chooses one track by id, always renders fades, and `applyEffects` is removed** (`ExportWavButton` and `useExportWav().exportWav()`, from `@waveform-playlist/browser/tone`; #817).

- `mode` and `trackIndex` are replaced by `trackId`: given, that track alone is exported; left out, the mix. An id that is not among the tracks rejects with `No track with id "<id>" to export`.
- A track exported alone is rendered as it sounds on its own: its mute is ignored, as the other tracks' solo already was. A muted track exported alone was a silent file.
- `applyEffects` is removed. It defaulted to `true` and turned off the master chain, every track chain and the clip fades together. Fades are now always rendered; each effect chain is rendered when its function (`effectsFunction`, `createOfflineTrackEffects`) is given.
- `isExporting` stays `true` until the last export started from the same `useExportWav()` call has finished (the first to finish cleared it), and `progress` is the progress of the export started last.
- `ExportWavButton` writes a failed export to the console with `console.error` when no `onExportError` is given (it was dropped), and a throw from `onExportComplete` is no longer reported to `onExportError`.
- `exportWav`'s `trackStates` parameter is typed `readonly (TrackState | undefined)[]`: a track with no entry is rendered with its own fields, as before.
