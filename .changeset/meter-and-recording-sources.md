---
'@waveform-playlist/browser': major
'@waveform-playlist/recording': major
'@waveform-playlist/ui-components': minor
'@waveform-playlist/core': minor
---

Meter levels and recording progress no longer go through React state (#695). They change about 60 times a second, and the component calling the hook re-rendered at that rate.

**Breaking, `@waveform-playlist/browser/tone`:** `useOutputMeter` returns `{ meter, resetPeak, error }`. `levels`, `peakLevels` and `rmsLevels` are read from `meter` (a `MeterSource`).

**Breaking, `@waveform-playlist/recording`:**

- `useMicrophoneLevel` returns `{ meter, resetPeak, error }`. `levels`, `peakLevels`, `rmsLevels` and the scalar `level` / `peakLevel` are gone.
- `useRecording` returns `progress` (a `RecordingProgressSource` holding `duration` and `peaks`) instead of `duration` and `peaks`. The deprecated, always-0 `level` and `peakLevel` are removed.
- `useIntegratedRecording` returns `meter` and `progress` instead of `duration`, `level`, `peakLevel`, `levels`, `peakLevels`, `rmsLevels` and `recordingPeaks`.

**Breaking, `@waveform-playlist/browser`:** the `recordingState` prop of `<Waveform>` and `PlaylistVisualization` takes `progress` instead of `durationSamples` and `peaks`. While a take runs past the end of the timeline, the displayed timeline now grows in 10-second steps instead of every frame.

**New:**

- `@waveform-playlist/core`: `ValueSource<T>` (`subscribe` + `getSnapshot`, the shape `useSyncExternalStore` takes), `MeterLevels`, `MeterSource`, `RecordingProgress`, `RecordingProgressSource`, `createValueSource`, `silentMeterLevels`, `readMeterMessage`.
- `@waveform-playlist/ui-components`: `<SegmentedVUMeter meter={meter} />` draws each new value straight to the DOM without rendering (the `levels` / `peakLevels` props still work); `useMeterLevels(meter, { updateRate })` and the generic `useThrottledValue(source, { updateRate })` give the values as React state at a limited rate (default 10 per second). Segment colours are computed once per threshold set.
- `@waveform-playlist/recording`: `useRecordingProgress(progress, { updateRate })`.

Measured on the recording example (4 tracks, dev build): idle with a microphone stream, 63 React commits and about 17,000 component renders per second before, 0 after; recording, 182 commits and about 43,000 component renders per second before, 60 commits and about 1,140 after (the preview clip only).
