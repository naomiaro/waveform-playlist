---
'@waveform-playlist/browser': major
---

**Breaking: the WAV export chooses one track by id, always renders fades, and `applyEffects` is removed** (`ExportWavButton` and `useExportWav().exportWav()`, from `@waveform-playlist/browser/tone`; #817).

- `mode` and `trackIndex` are replaced by `trackId`: given, that track alone is exported; left out, the mix. An id that is not among the tracks rejects with `No track with id "<id>" to export`.
- A track exported alone is rendered as it sounds on its own, through the master chain when one is given: its mute is ignored, as the other tracks' solo already was. A muted track exported alone was a silent file.
- The mix leaves out every muted track. A track both muted and soloed was silent but still counted for the channel count (a stereo clip on it made the file stereo).
- `applyEffects` is removed. It defaulted to `true` and turned off the master chain, every track chain and the clip fades together. Fades are now always rendered; each effect chain is rendered when its function (`effectsFunction`, `createOfflineTrackEffects`) is given.
- TypeScript reports a leftover `mode`, `trackIndex` or `applyEffects`; in JavaScript, or in an options object built elsewhere, it is ignored without a warning: `mode: 'individual'` with `trackIndex` exports the mix (to `<filename>.wav`), and `applyEffects: false` next to an effects function exports with the effects. The upgrade guide has the find-and-replace.
- `isExporting` stays `true` until the last export started from the same `useExportWav()` call has finished (the first to finish cleared it), and `progress` is the progress of the export started last. An export refused at once (no tracks, an unknown `trackId`) rejects and sets `error` without changing either.
- `ExportWavButton` writes a failed export to the console with `console.error` (the error as the second argument) when no `onExportError` is given (it was dropped), and a throw from `onExportComplete` is no longer reported to `onExportError`: it is an unhandled rejection of the click.
- `exportWav`'s `trackStates` parameter is typed `readonly (TrackState | undefined)[]`: a track with no entry is rendered with its own fields (the values it was created with).
