---
'@waveform-playlist/browser': minor
---

`loadWaveformData(src, options?)`, `loadPeaksFromWaveformData(src, channelIndex?, options?)` and `getWaveformDataMetadata(src, options?)` take `options.signal` (`WaveformDataLoadOptions`, exported), passed to `fetch()`: an abort rejects with the signal's `reason`, as `fetch()` does (#848).
