# @waveform-playlist/recording

Audio recording support for waveform-playlist using AudioWorklet — mic capture, live waveform preview, VU metering, and overdub, as a set of React hooks.

## Features

- **AudioWorklet-based capture** — direct PCM access on the audio thread, no `ScriptProcessorNode`
- **Live waveform preview** — incremental per-channel peaks as you record, before the final `AudioBuffer` exists
- **Sample-accurate VU metering** — a dedicated meter worklet measures peak/RMS on every sample, not just once per animation frame
- **Multi-channel recording** — auto-detects the microphone's actual channel count from the `MediaStream`
- **Overdub with latency compensation** — record against existing playback; the finalized clip's timeline position accounts for output latency and Tone.js scheduling lookahead, with an optional manual override
- **Device selection & hot-plug** — enumerate microphones, switch devices between takes (refused while actively recording — a mid-recording switch would silently record silence), auto-fallback if the active device disconnects
- **Pause/resume** — pauses the worklet itself, not just the UI
- **Hooks only** — no bundled UI components; wire the state into your own controls or `@waveform-playlist/ui-components`'s `SegmentedVUMeter`

## Installation

```bash
npm install @waveform-playlist/recording
```

`@waveform-playlist/recording` requires these peer dependencies:

| Package | Purpose |
|---------|---------|
| `react` | ^18.0.0 |
| `styled-components` | ^6.0.0 — required transitively by `@waveform-playlist/ui-components` |
| `tone` | ^15.0.0 — recording shares the global AudioContext with `@waveform-playlist/playout` |

Pairs with `@waveform-playlist/browser` — see the [Recording guide](https://naomiaro.github.io/waveform-playlist/docs/react/guides/recording) for a full `WaveformPlaylistProvider` integration.

## Usage

### Basic Recording

```tsx
import { useMicrophoneAccess, useRecording } from '@waveform-playlist/recording';

function RecordButton() {
  const { stream, hasPermission, requestAccess } = useMicrophoneAccess();
  const { isRecording, duration, peaks, startRecording, stopRecording } = useRecording(stream);

  const handleRecord = async () => {
    if (!hasPermission) {
      await requestAccess();
      return;
    }

    if (isRecording) {
      const audioBuffer = await stopRecording();
      // audioBuffer is the finalized AudioBuffer — add it to a track, upload it, etc.
    } else {
      await startRecording();
    }
  };

  return (
    <button onClick={handleRecord}>
      {isRecording ? `Stop (${duration.toFixed(1)}s)` : 'Record'}
    </button>
  );
}
```

### VU Meter

`useMicrophoneLevel` drives level monitoring independently of recording — useful for an input-check screen before the user hits record.

```tsx
import { useMicrophoneAccess, useMicrophoneLevel } from '@waveform-playlist/recording';
import { SegmentedVUMeter } from '@waveform-playlist/ui-components';

function MicMonitor() {
  const { stream, requestAccess } = useMicrophoneAccess();
  const { levels, peakLevels } = useMicrophoneLevel(stream, { channelCount: 2 });

  return (
    <>
      <button onClick={() => requestAccess()}>Enable Microphone</button>
      <SegmentedVUMeter levels={levels} peakLevels={peakLevels} />
    </>
  );
}
```

### Integrated Recording (with a track list)

`useIntegratedRecording` combines microphone access, metering, and recording into one hook that appends the finalized clip directly to a `ClipTrack[]` — the same array shape used by `@waveform-playlist/browser`'s `WaveformPlaylistProvider`.

```tsx
import { useIntegratedRecording } from '@waveform-playlist/recording';
import type { ClipTrack } from '@waveform-playlist/core';

function Recorder({
  tracks,
  setTracks,
  selectedTrackId,
  currentTime,
}: {
  tracks: ClipTrack[];
  setTracks: (tracks: ClipTrack[]) => void;
  selectedTrackId: string | null;
  currentTime: number;
}) {
  const {
    isRecording,
    duration,
    levels,
    peakLevels,
    devices,
    selectedDevice,
    requestMicAccess,
    changeDevice,
    startRecording,
    stopRecording,
    recordingPeaks, // live per-channel peaks — feed straight into your waveform preview
    error,
  } = useIntegratedRecording(tracks, setTracks, selectedTrackId, {
    currentTime,
    channelCount: 2,
  });

  return (
    <div>
      <button onClick={() => requestMicAccess()}>Enable Microphone</button>
      <button onClick={isRecording ? stopRecording : startRecording} disabled={!selectedTrackId}>
        {isRecording ? `Stop (${duration.toFixed(1)}s)` : 'Record'}
      </button>
      {error && <p>{error.message}</p>}
    </div>
  );
}
```

Stopping adds a new `AudioClip` to `selectedTrackId` at the timeline position captured when recording STARTED (punch-in semantics): the take lands exactly at the playhead and REPLACES any existing clip content it overlaps — partial overlaps are trimmed, fully-covered clips removed, and a clip spanning the take is split in two.

## API Reference

### Hooks

#### `useMicrophoneAccess()`

Manages microphone permission, device enumeration, and hot-plug detection.

**Returns (`UseMicrophoneAccessReturn`):**
- `stream: MediaStream | null`
- `devices: MicrophoneDevice[]` — `{ deviceId, label, groupId }`
- `hasPermission: boolean`
- `isLoading: boolean`
- `requestAccess: (deviceId?: string, audioConstraints?: MediaTrackConstraints) => Promise<void>`
- `stopStream: () => void`
- `error: Error | null`

Requested audio constraints default to `echoCancellation: false`, `noiseSuppression: false`, `autoGainControl: false`, `latency: 0` (raw signal, low latency) — pass `audioConstraints` to override.

#### `useRecording(stream, options?)`

The core AudioWorklet-based recording hook.

**Parameters:**
- `stream: MediaStream | null`
- `options?: RecordingOptions`
  - `channelCount?: number` — fallback used only if the stream doesn't report its own channel count (default: `1`)
  - `samplesPerPixel?: number` — peak resolution for the live preview (default: `1024`)
  - `bits?: 8 | 16` — peak value bit depth (default: `16`)

**Returns (`UseRecordingReturn`):**
- `isRecording: boolean`, `isPaused: boolean`, `duration: number` (seconds)
- `peaks: (Int8Array | Int16Array)[]` — one entry per channel, growing live during recording
- `audioBuffer: AudioBuffer | null` — set after `stopRecording()` resolves
- `level: number`, `peakLevel: number` — **deprecated** (always `0`); use `useMicrophoneLevel` for metering. Removed in the next major
- `startRecording: () => Promise<boolean>` — resolves `true` when the capture pipeline actually started (`false`: no stream, already recording, worklet failure); check it before starting synchronized playback
- `stopRecording: () => Promise<AudioBuffer | null>` — awaits the worklet's final flush before resolving, so the last samples are never dropped
- `pauseRecording: () => void`, `resumeRecording: () => void` — pause/resume the worklet itself, not just the UI
- `error: Error | null`

#### `useMicrophoneLevel(stream, options?)`

Sample-accurate VU metering via a separate meter AudioWorklet — independent of `useRecording`, so it works before recording starts.

**Parameters:**
- `stream: MediaStream | null`
- `options?: UseMicrophoneLevelOptions`
  - `updateRate?: number` — Hz (default: `60`)
  - `channelCount?: number` (default: `1`)

**Returns (`UseMicrophoneLevelReturn`):**
- `levels: number[]`, `peakLevels: number[]`, `rmsLevels: number[]` — per channel, normalized 0–1
- `level: number`, `peakLevel: number` — scalar convenience values (max across channels when `channelCount > 1`)
- `resetPeak: () => void` — clears held peak indicators, e.g. on device switch
- `error: Error | null`

#### `useIntegratedRecording(tracks, setTracks, selectedTrackId, options?)`

Batteries-included hook: wires `useMicrophoneAccess` + `useMicrophoneLevel` + `useRecording` together and appends the finalized recording to `tracks` as a new `AudioClip`.

**Parameters:**
- `tracks: ClipTrack[]`, `setTracks: (tracks: ClipTrack[]) => void`, `selectedTrackId: string | null`
- `options?: IntegratedRecordingOptions`
  - `currentTime?: number` — playback/cursor position; the clip is captured at this position at record *start* (not stop), so overdubbing while transport is running lands the clip correctly
  - `audioConstraints?: MediaTrackConstraints`
  - `channelCount?: number` (default: `1`)
  - `samplesPerPixel?: number` (default: `1024`)
  - `latencyOffset?: number` — seconds; overrides the auto-computed `outputLatency + lookAhead` compensation applied to the clip's start. `0` disables compensation; omit to auto-compute

**Returns (`UseIntegratedRecordingReturn`):** recording state (`isRecording`, `isPaused`, `duration`, `level`, `peakLevel`, `levels`, `peakLevels`, `rmsLevels`), microphone state (`stream`, `devices`, `hasPermission`, `selectedDevice`), controls (`startRecording` — resolves `true` when capture actually started, `stopRecording`, `pauseRecording`, `resumeRecording`, `requestMicAccess`, `changeDevice`), `recordingPeaks` (live per-channel peaks for preview), and a combined `error`.

**Overdub with `@waveform-playlist/browser`:** call `usePlaylistControls().setRecordingActive(true, trackId)` *before* `play()` — while the session is active the end-of-timeline auto-stop is suppressed (the take can run past existing audio) and the recorded-over track's existing content is transiently muted (punch-in replaces it). Both reset automatically when the recording ends; check `startRecording()`'s boolean and release the session on `false`.

### Types

`RecordingState`, `RecordingData`, `MicrophoneDevice`, `RecordingOptions`, `UseRecordingReturn`, `UseMicrophoneAccessReturn` are all exported from the package root for consumers building their own UI around these hooks.

## Architecture

```
getUserMedia → MediaStream
                    ↓
   MediaStreamSource (shared global AudioContext)
                    ↓
    AudioWorklet Processors (from @waveform-playlist/worklets)
    - recording-processor: captures raw PCM per channel
    - meter-processor: sample-accurate peak/RMS
                    ↓
        Main Thread (React Hooks)
          - Accumulates audio data per channel
          - Generates live peaks incrementally
          - Updates VU meter state
                    ↓
   Final AudioBuffer (after stopRecording's stop-handshake)
```

Each hook creates its own `MediaStreamSource` from the shared context rather than reusing one across hooks — required for Firefox, which throws if source and destination nodes come from different context instances.

## Browser Support

- Chrome 66+
- Firefox 76+
- Edge 79+
- Safari 14.1+

Requires HTTPS or localhost for microphone access.

## License

MIT
