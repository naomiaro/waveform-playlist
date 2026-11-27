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
| `react` | ^19.0.0 |
| `react-dom` | ^19.0.0 — required transitively by `@waveform-playlist/ui-components` |
| `styled-components` | ^6.0.0 — required transitively by `@waveform-playlist/ui-components` |
| `tone` | ^15.0.0 — recording shares the global AudioContext with `@waveform-playlist/playout` |

Pairs with `@waveform-playlist/browser` — see the [Recording guide](https://naomiaro.github.io/waveform-playlist/docs/react/guides/recording) for a full `WaveformPlaylistProvider` integration.

## Usage

### Basic Recording

```tsx
import {
  useMicrophoneAccess,
  useRecording,
  useRecordingProgress,
} from '@waveform-playlist/recording';

function RecordButton() {
  const { stream, hasPermission, requestAccess } = useMicrophoneAccess();
  const { isRecording, progress, startRecording, stopRecording } = useRecording(stream);
  // `progress` is a source ({ duration, peaks }), not state: useRecording does
  // not re-render as the take grows. This reads it 10 times a second.
  const { duration } = useRecordingProgress(progress);

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
  const { meter } = useMicrophoneLevel(stream, { channelCount: 2 });

  return (
    <>
      <button onClick={() => requestAccess()}>Enable Microphone</button>
      <SegmentedVUMeter meter={meter} />
    </>
  );
}
```

`meter` is a source, not state: levels change about 60 times a second, and the hook does not re-render for them. `SegmentedVUMeter` draws each reading straight to the DOM. For the numbers in render, use `useMeterLevels(meter)` from `@waveform-playlist/ui-components` (10 updates a second by default), or `meter.subscribe(callback)` to draw them yourself.

### Integrated Recording (into an arrangement)

`useIntegratedRecording` combines microphone access, metering, and recording into one hook that adds the finalized clip to a track of an `Arrangement` — the object `@waveform-playlist/browser`'s `useCreateArrangement` makes and `WaveformPlaylistProvider` plays. This package depends on `@waveform-playlist/engine` and imports only types from it.

```tsx
import { useIntegratedRecording, useRecordingProgress } from '@waveform-playlist/recording';
import type { RecordingProgressSource } from '@waveform-playlist/core';
import type { Arrangement } from '@waveform-playlist/engine';

// Only this label re-renders as the take grows.
function ElapsedTime({ progress }: { progress: RecordingProgressSource }) {
  const { duration } = useRecordingProgress(progress);
  return <>{duration.toFixed(1)}s</>;
}

function Recorder({
  arrangement,
  selectedTrackId,
  currentTime,
}: {
  arrangement: Arrangement;
  selectedTrackId: string | null;
  currentTime: number;
}) {
  const {
    isRecording,
    meter, // live microphone levels — <SegmentedVUMeter meter={meter} />
    progress, // the take's elapsed time and live peaks — <WaveformRecordingPreview recordingState={{ …, progress }} />
    devices,
    selectedDevice,
    requestMicAccess,
    changeDevice,
    startRecording,
    stopRecording,
    error,
  } = useIntegratedRecording(arrangement, selectedTrackId, {
    currentTime,
    channelCount: 2,
  });

  return (
    <div>
      <button onClick={() => requestMicAccess()}>Enable Microphone</button>
      <button onClick={isRecording ? stopRecording : startRecording} disabled={!selectedTrackId}>
        {isRecording ? (
          <>
            Stop (<ElapsedTime progress={progress} />)
          </>
        ) : (
          'Record'
        )}
      </button>
      {error && <p>{error.message}</p>}
    </div>
  );
}
```

Stopping adds a new `AudioClip` to the track that was selected when the take STARTED (`recordingTrackId`), at the timeline position captured then (punch-in semantics): the take lands exactly at the playhead and REPLACES any existing clip content it overlaps — partial overlaps are trimmed, fully-covered clips removed, and a clip spanning the take is split in two. The take and that carve are one `arrangement.updateTrack()`: one undo step.

`startRecording()` resolves `false`, records nothing and sets `error` (a message that starts with `Cannot start recording: ` and names the track) when no track is selected, when the arrangement holds no track of the selected id, for a MIDI track, and for a track holding a clip whose audio is not loaded (still loading, failed to load, or a clip that cannot be made from its audio).

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
- `isRecording: boolean`, `isPaused: boolean`
- `progress: RecordingProgressSource` — a source of `{ duration: number; peaks: (Int8Array | Int16Array)[] }` (seconds elapsed; one peaks entry per channel, growing live). Published once per animation frame while recording; the hook does not re-render for it. After a stop, `duration` is the recorded buffer's length
- `audioBuffer: AudioBuffer | null` — set after `stopRecording()` resolves
- `startRecording: () => Promise<boolean>` — resolves `true` when the capture pipeline actually started (`false`: no stream, already recording, worklet failure); check it before starting synchronized playback
- `stopRecording: () => Promise<AudioBuffer | null>` — awaits the worklet's final flush before resolving, so the last samples are never dropped
- `pauseRecording: () => void`, `resumeRecording: () => void` — pause/resume the worklet itself, not just the UI
- `error: Error | null`

#### `useRecordingProgress(progress, options?)`

A recording's `{ duration, peaks }` as React state, at most `options.updateRate` times a second (default: `10`). Use it for slow displays such as an elapsed-time label. Pass the `progress` source itself to `<WaveformRecordingPreview recordingState>` (a child of `<WaveformTracks>` from `@waveform-playlist/browser`) for the live preview.

#### `useMicrophoneLevel(stream, options?)`

Sample-accurate VU metering via a separate meter AudioWorklet — independent of `useRecording`, so it works before recording starts.

**Parameters:**
- `stream: MediaStream | null`
- `options?: UseMicrophoneLevelOptions`
  - `updateRate?: number` — Hz (default: `60`)
  - `channelCount?: number` (default: `1`)

**Returns (`UseMicrophoneLevelReturn`):**
- `meter: MeterSource` — a source of `{ levels: number[]; peakLevels: number[]; rmsLevels: number[] }`, per channel, normalized 0–1. Stable identity; the hook does not re-render as levels change. Read it with `<SegmentedVUMeter meter={meter} />`, `useMeterLevels(meter)`, or `meter.subscribe(callback)` / `meter.getSnapshot()`
- `resetPeak: () => void` — clears held peak indicators, e.g. on device switch
- `error: Error | null`

#### `useIntegratedRecording(arrangement, selectedTrackId, options?)`

Batteries-included hook: wires `useMicrophoneAccess` + `useMicrophoneLevel` + `useRecording` together and adds the finalized recording to the arrangement's track as a new `AudioClip`, with one `arrangement.updateTrack()` (one undo step). It keeps no copy of the tracks: it reads the arrangement when a take starts and when it ends.

**Parameters:**
- `arrangement: Arrangement` (from `@waveform-playlist/engine`; `useCreateArrangement` of `@waveform-playlist/browser`), `selectedTrackId: string | null` (the track the next take is recorded onto)
- `options?: IntegratedRecordingOptions`
  - `currentTime?: number` — playback/cursor position; the clip is captured at this position at record *start* (not stop), so overdubbing while transport is running lands the clip correctly
  - `audioConstraints?: MediaTrackConstraints`
  - `channelCount?: number` (default: `1`)
  - `samplesPerPixel?: number` (default: `1024`)
  - `latencyOffset?: number` — seconds; overrides the auto-computed `outputLatency + lookAhead` compensation applied to the clip's start. `0` disables compensation; omit to auto-compute

**Returns (`UseIntegratedRecordingReturn`):** recording state (`isRecording`, `isPaused`, `recordingTrackId`: the track the running take was started on, `null` when none is running), the two live sources (`meter`: microphone levels; `progress`: the take's elapsed time and per-channel preview peaks), microphone state (`stream`, `devices`, `hasPermission`, `selectedDevice`), controls (`startRecording` — resolves `true` when capture actually started, `false` with `error` set when the take is refused, `stopRecording`, `pauseRecording`, `resumeRecording`, `requestMicAccess`, `changeDevice`), and a combined `error`.

**Recording into a `@waveform-playlist/browser` playlist:** call `useRecordingSession({ isRecording, trackId: recordingTrackId })` (from `@waveform-playlist/browser`) in the component that calls `useIntegratedRecording`; the view's `<WaveformRecordingPreview>` only draws the take. For an overdub, also call `useEditorControls().setRecordingActive(true, trackId)` *before* `play()` — while the session is active the end-of-timeline auto-stop is suppressed (the take can run past existing audio) and the recorded-over track plays muted for the take (punch-in replaces what it holds; `arrangement.setTrackRecording`, which leaves the track's own mute in the arrangement's mix alone): the mixer and the track's Mute button show it, the built-in `<TrackMuteButton />` is disabled, and `useTrack().isRecording` is true for it. A mute set on the track during the take stays after it. Both reset automatically when the recording ends; check `startRecording()`'s boolean and release the session on `false`. `play()` does nothing before the playlist's first ready, so a take started during the first load records without playback.

### Types

`MicrophoneDevice`, `RecordingOptions`, `UseRecordingReturn`, `UseMicrophoneAccessReturn` are all exported from the package root for consumers building their own UI around these hooks.

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
