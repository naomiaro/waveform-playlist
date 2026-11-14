# Recording preview and meters

Notes of Browser Package (`@waveform-playlist/browser`), moved out of the package's `CLAUDE.md`. Read before changing the recording preview, a meter or any value that changes every frame.

## Recording Preview Rendering Path

**Two paths for recording data:**

1. **Live preview** — `RecordingPreviewClip` (`components/TrackRows.tsx`) subscribes to `recordingState.progress` and renders its peaks directly, one `ChannelWithProgress` per channel. Bypasses the `WaveformPlaylistContext` peak generation pipeline entirely.
2. **Post-recording** — clips go through `derivePeaks` (Path A/B/C), which applies `mono` merge via `extractPeaksFromWaveformDataFull`.

Both paths must respect `mono` flag consistently. Live preview slices to first channel when `mono` is true. `recordingState.bits` flows through to the renderer (not hardcoded).

**Live preview must strip latency** — Playhead uses audible time (raw − `outputLatency` − `lookAhead`); preview peaks must drop the leading-silence portion to match. Compute `latencyOffsetSamples = (outputLatency + lookAhead) * sampleRate`, slice each channel via `subarray(latencyPixels * 2)` (each pixel is min/max), and reduce the preview clip's `durationSamples` by `latencyOffsetSamples`. Container `startSample` stays raw — only the audio data shifts. Mirrors `useIntegratedRecording`'s finalization compensation (PR #384).

**`durationSamples` must be zoom-independent:** Use `duration * sampleRate`, not peaks-derived calculations that depend on `samplesPerPixel` (which changes on zoom).

## 60 Hz Values Are Sources, Not State (#695)

Meter levels and recording progress change about 60 times a second. They are published through core's `ValueSource` (`subscribe` + `getSnapshot`) and never put in React state by the library:

- `useOutputMeter()` returns `{ meter, resetPeak, error }`. `meter` keeps its identity for the life of the hook, and the hook does not re-render when levels change. `<SegmentedVUMeter meter={meter} />` draws from it; `useMeterLevels(meter)` (ui-components) is the opt-in, throttled state.
- `<WaveformRecordingPreview recordingState>` takes `progress` (from `useRecording` / `useIntegratedRecording`), not `durationSamples` and `peaks`. `RecordingPreviewClip` is the ONLY component that follows it frame by frame (`useSyncExternalStore`). The shell reads two numbers through `useRecordingLayout` (`hooks/useRecordingLayout.ts`): the take's channel count and `recordingDisplayEnd()`, the timeline end the take needs, which moves in 10-second steps (10 to 20 s ahead of the take). Selectors that return numbers are what keep the shell from rendering per frame; do not read `progress.getSnapshot()` in the shell's render for anything else.
- Rule for new per-frame data: add a source (or a frame callback while playing), let the one component that draws it subscribe, and give everything else a coarse selector. Never thread the value through the host component as a prop.

Measured on the recording example (4 tracks, dev build, fiber-walk probe): idle with a mic stream 63 commits/s and about 17,000 component renders/s before, 0 after; recording 182 commits/s and about 43,000 renders/s before, 60 and about 1,140 after (the preview clip). `recordingPreviewSubscription.test.tsx` counts renders with wrappers around the real components; `e2e/recording.spec.ts` drives the page with a synthetic microphone.

## Output Metering (useOutputMeter)

**Critical: Context mismatch gotcha.** Always use `getGlobalContext()` from `@waveform-playlist/playout` — never `getContext()`/`getDestination()` from Tone.js. `getGlobalContext()` creates a new Context via `setContext()`, replacing the default. Nodes created with `getContext()` before that happens end up on a dead audio graph.

**Destination.chain(workletNode)** inserts the meter worklet as a pass-through in the master output. Audio flows through unchanged while the worklet measures every sample. Cleanup: `destination.chain()` restores the default path.

**Sample-accurate metering:** Uses `meter-processor` AudioWorklet from `@waveform-playlist/worklets`. The worklet accumulates peak and RMS across all 128-sample quantums and posts results at ~60Hz — no transient is missed between animation frames.

## Output Meter Clearing (isPlaying Prop)

**Problem:** When playback stops, browsers stop calling the worklet's `process()` (tail-time optimization — no active upstream sources). The last non-zero levels freeze in React state.

**Fix:** `useOutputMeter({ isPlaying })` — a separate `useEffect` publishes silent levels (current, peak, RMS) and clears the smoothed state when `isPlaying` transitions to `false`. Prefer state-driven cleanup over staleness timers. A worklet message that is still in flight when the reset runs starts the smoothed peak decaying again, so on the recording example the output meter falls over about three seconds after Stop rather than at once (seen while checking #695 and not compared against a build from before it; the reset and the message handler are the same logic as before).
