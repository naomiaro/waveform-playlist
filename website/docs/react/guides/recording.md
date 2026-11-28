---
sidebar_position: 7
description: "Record audio with AudioWorklet processing, live waveform preview, and VU metering"
---

# Recording

Record audio directly from the microphone with level monitoring and waveform visualization.

## Installation

Install the recording package:

```bash npm2yarn
npm install @waveform-playlist/recording
```

## Basic Recording

```tsx
import {
  WaveformPlaylistProvider,
  Waveform,
  useCreateArrangement,
} from '@waveform-playlist/browser';
import {
  useRecording,
  useMicrophoneAccess,
} from '@waveform-playlist/recording';

function RecordButton() {
  const { requestAccess, stream } = useMicrophoneAccess();
  const { isRecording, startRecording, stopRecording } = useRecording(stream);

  const handleRecord = async () => {
    if (!stream) {
      // This render's startRecording has no stream yet: the next press records.
      await requestAccess();
      return;
    }

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <button onClick={handleRecord}>
      {isRecording ? 'Stop Recording' : 'Start Recording'}
    </button>
  );
}

function RecordingExample() {
  // An empty arrangement: this example only captures; see below for adding the take to a track
  const arrangement = useCreateArrangement();

  return (
    <WaveformPlaylistProvider arrangement={arrangement}>
      <RecordButton />
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

## Microphone Access

### useMicrophoneAccess Hook

Request and manage microphone permissions:

```tsx
import { useMicrophoneAccess } from '@waveform-playlist/recording';

function MicrophoneSetup() {
  const {
    stream,
    isLoading,
    error,
    requestAccess,
    stopStream,
  } = useMicrophoneAccess();

  if (isLoading) {
    return <div>Requesting microphone access...</div>;
  }

  if (error) {
    return <div>Microphone error: {error.message}</div>;
  }

  return (
    <div>
      <p>Microphone: {stream ? 'Open' : 'Not open'}</p>
      {!stream ? (
        <button onClick={() => requestAccess()}>Grant Microphone Access</button>
      ) : (
        <button onClick={stopStream}>Stop Microphone</button>
      )}
    </div>
  );
}
```

To ask from a mount effect, call `requestAccess()` in the effect without a run-once guard (a ref that skips the second run). In development, StrictMode runs the effect, cleans it up and runs it again. The hook stops a request that was still waiting for the browser when a cleanup ran, so a guarded effect opens no microphone; an unguarded one asks again and gets it. React's own advice is the same: [don't use refs to prevent an effect from running twice](https://react.dev/learn/synchronizing-with-effects#dont-use-refs-to-prevent-effects-from-firing).

```tsx
const { requestAccess } = useMicrophoneAccess();
useEffect(() => {
  requestAccess();
}, [requestAccess]);
```

### Audio Constraints

Customize microphone settings:

```tsx
const { requestAccess } = useMicrophoneAccess();

// Pass audio constraints when requesting access:
await requestAccess(undefined, {
  echoCancellation: false,     // Preserve raw audio
  noiseSuppression: false,     // No processing
  autoGainControl: false,      // Manual gain control
  sampleRate: 48000,           // Higher sample rate
});
```

Default constraints optimize for recording quality:

| Constraint | Default | Purpose |
|------------|---------|---------|
| `echoCancellation` | `false` | Preserve raw audio |
| `noiseSuppression` | `false` | No processing artifacts |
| `autoGainControl` | `false` | Consistent levels |
| `latency` | `0` | Low latency monitoring |

### Choosing a Microphone

Browsers hide the microphones until the page has been granted microphone permission: `devices` is then usually one entry with an empty `deviceId` (none on a machine with no microphone), and `hasLabels` is `false`. After a grant, `devices` names every microphone and `hasLabels` is `true`. `hasLabels` changes only when the list is read again (on mount, on a `devicechange`, after a grant), so it stays `true` after `stopStream()`. Showing a hidden component reads the list again, with no microphone open; whether the browser names the devices then decides `hasLabels` (not run: our runs listed devices with no stream only before a first grant).

What the browsers did in our runs (headless Chromium, Firefox and WebKit, Safari's engine, with fake devices; not on real hardware):

- Chromium, with the permission already granted, named the microphones before any was open: the app can offer the list and open only the one chosen.
- Firefox and WebKit named them only once a microphone was open, WebKit also with the permission granted. There the first open is `requestMicAccess()`, the browser's default microphone (or the one the `audioConstraints` option names), and the picker can be offered after it.

`selectedDevice` of `useIntegratedRecording` is the microphone that is open: the id its stream reports (`getSettings().deviceId`), or `null` while none is open. That is before the first request, after an unplug or a request that failed, and while a request is opening one (a request closes the open microphone first). For the default microphone, Chromium reported `'default'`, the id of its list's "Default" entry; Firefox and WebKit reported the device's own id.

A picker shows `selectedDevice` only when `devices` holds it: React gives a `<select>` whose value matches no option its first enabled option, which would name another microphone. That happens when a list read fails, and for a moment after a first grant, before the list is read again.

```tsx
const {
  devices,
  hasLabels,
  stream,
  selectedDevice,
  isRecording,
  requestMicAccess,
  changeDevice,
} = useIntegratedRecording(arrangement, selectedTrackId);

// Before a first grant the browser names no device: open the default one.
// Once the devices are named, choosing one opens only that microphone.
if (!stream && !hasLabels) {
  return <button onClick={requestMicAccess}>Enable microphone</button>;
}

const listed = devices.some((d) => d.deviceId === selectedDevice);
return (
  <label>
    Microphone
    <select
      value={(listed && selectedDevice) || ''}
      onChange={(e) => changeDevice(e.target.value)}
      disabled={isRecording}
    >
      {!listed && (
        <option value="" disabled>
          Choose a microphone
        </option>
      )}
      {devices.map((d) => (
        <option key={d.deviceId} value={d.deviceId}>
          {d.label}
        </option>
      ))}
    </select>
  </label>
);
```

With `useMicrophoneAccess` alone, `hasLabels` is the same field, `requestAccess(deviceId)` opens one microphone by its id, and the open one is `stream?.getAudioTracks()[0]?.getSettings().deviceId`.

## Recording Controls

### useRecording Hook

The main hook for recording functionality. It requires a `MediaStream` from `useMicrophoneAccess`:

```tsx
import {
  useRecording,
  useRecordingProgress,
  useMicrophoneAccess,
} from '@waveform-playlist/recording';

function RecordingControls() {
  const { stream } = useMicrophoneAccess();
  const {
    isRecording,
    isPaused,
    progress,
    audioBuffer,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  } = useRecording(stream);
  // Elapsed time changes every animation frame, so the hook returns it as a
  // source (`progress`) and does not re-render for it. useRecordingProgress
  // turns it into state at 10 updates a second, which is enough for a label.
  const { duration } = useRecordingProgress(progress);

  return (
    <div>
      <p>Recording: {isRecording ? 'Yes' : 'No'}</p>
      <p>Duration: {duration.toFixed(1)}s</p>

      {!isRecording ? (
        <button onClick={startRecording}>Record</button>
      ) : (
        <>
          <button onClick={stopRecording}>Stop</button>
          <button onClick={isPaused ? resumeRecording : pauseRecording}>
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </>
      )}

      {audioBuffer && (
        <p>Recorded {audioBuffer.duration.toFixed(1)}s of audio</p>
      )}
    </div>
  );
}
```

To start a take from an effect, start it on a value of your own (`shouldRecord` below), call the latest `startRecording` through a ref, and ignore the result once the effect has been cleaned up:

- `startRecording` of `useRecording` changes with the stream and the hook's options (`channelCount`, `samplesPerPixel`, `bits`). An effect that depends on it starts again on each change, also during a take, and that start resolves `false` at once.
- A start still getting ready when the component's effects are cleaned up (an unmount, a hide, Fast Refresh, StrictMode's development cleanup) resolves `false`. Under StrictMode that is the first run's start; the second run's start records.

Acting on such a `false` (releasing a session, showing a failure) can do so under a running take: StrictMode's second run, or the take a re-run was refused for. The `active` flag drops the ones a cleanup made stale. While `shouldRecord` stays `true`, the effect starts a new take when a hidden `<Activity>` is shown again (or on Fast Refresh): set it back to `false` when the take ends.

```tsx
const startRef = useRef(startRecording);
useLayoutEffect(() => {
  startRef.current = startRecording;
});

useEffect(() => {
  if (!shouldRecord) return;
  let active = true;
  startRef.current().then((started) => {
    if (active && !started) {
      // the take did not start: release what was set up for it
    }
  });
  return () => {
    active = false;
  };
}, [shouldRecord]);
```

### Mic Disconnect Detection

`useRecording` automatically detects when the microphone is unplugged or permission is revoked during recording. When the `MediaStreamTrack` 'ended' event fires, the hook stops the take and sets an `error` state. What was recorded until then is kept: it is in `audioBuffer`.

```tsx
const { error, audioBuffer } = useRecording(stream);

// error.message === 'Microphone disconnected during recording'
{error && <p style={{ color: 'red' }}>{error.message}</p>}
```

`useIntegratedRecording` adds that take to the track it was started on, as `stopRecording()` does.

`useMicrophoneAccess` follows the same event, recording or not: when the microphone's track ends, `stream` becomes `null` and `error` says "The microphone was disconnected or its permission was revoked. Request microphone access again." (`useIntegratedRecording` reports this one). The hooks never open another microphone by themselves, also when one is available: call `requestAccess()` / `requestMicAccess()` again, or `changeDevice(deviceId)` for a specific one. `devices` follows what is plugged in, and `selectedDevice` of `useIntegratedRecording` is `null` until a microphone is open again (see [Choosing a Microphone](#choosing-a-microphone)).

`useRecording` given an ended stream of your own refuses to start: `startRecording()` resolves `false` with an `error`, in place of recording silence. The same when the stream ends while the start is still getting ready (the audio context, the recording worklet): another microphone was opened (`requestAccess()`, or `requestMicAccess()` / `changeDevice()` of `useIntegratedRecording`), or it was unplugged. Press Record again once a microphone is open again.

### When the Component Is Hidden or Unmounted Mid-Take

React runs the hooks' effect cleanups when the component unmounts, when an `<Activity>` around it is hidden, and on Fast Refresh. The cleanups stop the recording worklet and the microphone stream, and the hooks' state says so:

- `useRecording`: `isRecording` and `isPaused` are `false`, and `audioBuffer` holds what was received until then (the worklet's last partial block, about 16 ms, and anything it had sent that had not arrived yet are not in it; `progress` keeps the last duration it published). `useIntegratedRecording` adds it to the take's track, also on an unmount.
- `useMicrophoneAccess`: `stream` is `null` and `isLoading` is `false`, as after `stopStream()`. A request that was waiting for the browser when the component was hidden opens nothing: the microphone the browser grants it is stopped, also when that happens after the component is shown again, and a refusal sets no `error`. Call `requestAccess()` again when the component is shown (`requestMicAccess()` of `useIntegratedRecording`). That opens the default microphone (or the one the `audioConstraints` option names), which `selectedDevice` then names; a microphone chosen earlier is opened again with `changeDevice(deviceId)`. The hooks keep no memory of it: keep the id in your app to offer it again.

### Without `navigator.mediaDevices`

On an origin that is not a secure context (plain `http` that is not `localhost`) the browser has no `navigator.mediaDevices`. `useMicrophoneAccess` mounts there with an empty `devices` list, and `requestAccess()` sets `error` ("Microphone access is not available: navigator.mediaDevices is undefined. It needs a secure context (https or localhost).").

:::tip Sample Rate Mismatch
The mic's native sample rate (from `MediaStreamTrack.getSettings().sampleRate`) may differ from the `AudioContext.sampleRate`. The browser automatically resamples at the `MediaStreamAudioSourceNode` boundary. To avoid resampling, match input and output sample rates in your system audio settings (e.g., macOS Audio MIDI Setup).
:::

## Accessing Recorded Audio Data

After recording stops, the `audioBuffer` from `useRecording` contains the full recorded audio as a Web Audio API [AudioBuffer](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer). You can also await the return value of `stopRecording()` to get the buffer directly.

### Getting the AudioBuffer

```tsx
import { useRecording, useMicrophoneAccess } from '@waveform-playlist/recording';

function RecordingWithDataAccess() {
  const { stream } = useMicrophoneAccess();
  const {
    isRecording,
    audioBuffer,
    startRecording,
    stopRecording,
  } = useRecording(stream);

  const handleStopAndProcess = async () => {
    // Option 1: Await stopRecording() directly
    const buffer = await stopRecording();
    if (buffer) {
      console.log('Duration:', buffer.duration, 'seconds');
      console.log('Sample rate:', buffer.sampleRate);
      console.log('Channels:', buffer.numberOfChannels);
    }
  };

  // Option 2: Access audioBuffer state after recording
  useEffect(() => {
    if (audioBuffer) {
      console.log('Recording complete:', audioBuffer.duration, 'seconds');
    }
  }, [audioBuffer]);

  return (
    <button onClick={isRecording ? handleStopAndProcess : startRecording}>
      {isRecording ? 'Stop' : 'Record'}
    </button>
  );
}
```

### Extracting Raw PCM Data

The `AudioBuffer` provides access to raw PCM sample data via `getChannelData()`:

```tsx
function processRecordedAudio(audioBuffer: AudioBuffer) {
  // Get raw PCM samples for each channel
  const leftChannel = audioBuffer.getChannelData(0);   // Float32Array
  const rightChannel = audioBuffer.numberOfChannels > 1
    ? audioBuffer.getChannelData(1)
    : leftChannel;

  console.log('Samples:', leftChannel.length);
  console.log('Sample rate:', audioBuffer.sampleRate);
  console.log('Duration:', audioBuffer.duration, 'seconds');

  // Sample values are floats between -1.0 and 1.0
  const peakLevel = Math.max(...leftChannel.map(Math.abs));
  console.log('Peak level:', peakLevel);

  return { leftChannel, rightChannel };
}
```

### Converting to Other Formats

You can convert the recorded audio to various formats:

```tsx
// Convert to 16-bit integer PCM
function toInt16PCM(floatData: Float32Array): Int16Array {
  const int16 = new Int16Array(floatData.length);
  for (let i = 0; i < floatData.length; i++) {
    // Clamp and convert float [-1, 1] to int16 [-32768, 32767]
    const s = Math.max(-1, Math.min(1, floatData[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16;
}

// Example usage
const pcmData = audioBuffer.getChannelData(0);
const int16Data = toInt16PCM(pcmData);
```

### Sending to a Server

```tsx
async function uploadRecording(audioBuffer: AudioBuffer) {
  // Get raw PCM data
  const pcmData = audioBuffer.getChannelData(0);

  // Send as Float32Array
  const response = await fetch('/api/upload-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: pcmData.buffer,
  });

  return response.json();
}
```

For WAV file export, use the `useExportWav` hook or `ExportWavButton` component described in the [Download Recorded Audio](#download-recorded-audio) section.

## Level Monitoring

### useMicrophoneLevel Hook

`useMicrophoneLevel` returns a `meter`: a source of `{ levels, peakLevels, rmsLevels }` that changes about 60 times a second. The hook does not re-render when it changes. The simplest display is `<SegmentedVUMeter meter={meter} />` from `@waveform-playlist/ui-components`, which draws each value straight to the DOM.

To build your own display from values in render, read the meter with `useMeterLevels`, which re-renders at most 10 times a second by default. Pass `channelCount: 2` to monitor stereo inputs:

```tsx
import { useMicrophoneAccess, useMicrophoneLevel } from '@waveform-playlist/recording';
import { useMeterLevels } from '@waveform-playlist/ui-components';

function LevelMeter() {
  const { stream } = useMicrophoneAccess();
  const { meter } = useMicrophoneLevel(stream, { channelCount: 2 });
  const { levels, peakLevels } = useMeterLevels(meter, { updateRate: 20 });

  // levels: number[] (per-channel peak levels, 0-1)
  // peakLevels: number[] (per-channel held peak levels, 0-1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {levels.map((level, ch) => (
        <div key={ch} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label>{ch === 0 ? 'L' : 'R'}</label>
          <div style={{ width: '200px', height: '20px', background: '#ddd' }}>
            <div
              style={{
                width: `${level * 100}%`,
                height: '100%',
                background: level > 0.9 ? 'red' : level > 0.7 ? 'yellow' : 'green',
                transition: 'width 50ms',
              }}
            />
          </div>
          <div style={{ width: '200px', height: '20px', background: '#ddd' }}>
            <div
              style={{
                width: `${peakLevels[ch] * 100}%`,
                height: '100%',
                background: peakLevels[ch] > 0.9 ? 'red' : '#333',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
```

For advanced metering including output meters and custom visualizations, see the [VU Meters guide](./vu-meters.md).

### Clipping Indicator

Warn users when audio is too loud:

```tsx
function ClippingIndicator({ stream }: { stream: MediaStream | null }) {
  const { meter } = useMicrophoneLevel(stream);
  const { peakLevels } = useMeterLevels(meter);
  const isClipping = peakLevels.some((peak) => peak > 0.95);

  return (
    <div
      style={{
        padding: '0.5rem 1rem',
        background: isClipping ? '#ff4444' : '#44ff44',
        color: isClipping ? 'white' : 'black',
        borderRadius: '4px',
      }}
    >
      {isClipping ? 'CLIPPING!' : 'Levels OK'}
    </div>
  );
}
```

## Adding Recorded Audio to Playlist

For multi-track recording with automatic track management, use the `useIntegratedRecording` hook from `@waveform-playlist/recording`. It takes the arrangement that owns the tracks and the id of the track to record onto:

```tsx
import { useArrangement } from '@waveform-playlist/browser';
import { useIntegratedRecording } from '@waveform-playlist/recording';

// Under <WaveformPlaylistProvider arrangement={arrangement}>
function RecordToPlaylist({ selectedTrackId }: { selectedTrackId: string | null }) {
  const arrangement = useArrangement();

  const {
    isRecording,
    startRecording,
    stopRecording,
    requestMicAccess,
    stream,
    error,
  } = useIntegratedRecording(arrangement, selectedTrackId);

  const handleRecord = async () => {
    if (!stream) {
      // Records on the next press, once the stream is open.
      await requestMicAccess();
      return;
    }

    if (isRecording) {
      // Stop recording — the clip lands at the record-start position and
      // replaces any overlapped clip content on the track (punch-in)
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <>
      <button onClick={handleRecord}>
        {isRecording ? 'Stop & Add to Playlist' : 'Start Recording'}
      </button>
      {error && <span role="alert">{error.message}</span>}
    </>
  );
}
```

The hook keeps no copy of the tracks: it reads the arrangement when the take starts and when it ends. The take is added to the track it was started on (whatever is selected by then) with one `arrangement.updateTrack()`, so the take and the clips it trims, removes or splits are **one undo step**.

`startRecording()` resolves `false`, records nothing and sets `error` when the take cannot start. Each message starts with `Cannot start recording: ` and names the track:

| Case | Message |
|---|---|
| No track selected | `Cannot start recording: no track selected. Select or create a track first.` |
| The arrangement has no track of the selected id | `Cannot start recording: the selected track "<id>" is not in the arrangement. Add it with arrangement.addTrack() first.` |
| A MIDI track | `Cannot start recording: "<name>" is a MIDI track. Select or create an audio track first.` |
| The track holds a clip still loading | `Cannot start recording: "<name>" holds a clip whose audio is still loading ("<clip id>"). Start the take once it has loaded.` |
| A clip of the track failed to load | `Cannot start recording: the audio of clip "<clip id>" on "<name>" could not be loaded (<reason>). Retry it with arrangement.retry(), or remove the clip.` |
| A clip of the track cannot be made from its audio | `Cannot start recording: a clip on "<name>" cannot be made from its audio (<reason>). Correct or remove the clip.` |

At the end of a take, a track that was removed meanwhile gives `Recording completed but track "<id>" no longer exists. The recorded audio could not be saved.`, and a track the arrangement refuses the take on gives `Recording completed but the take could not be saved on track "<id>": <reason>` (with the arrangement's error as `cause`). Both are logged as console warnings and set `error`; the take is not kept.

## Latency Compensation

When recording, there is typically a small delay between when audio enters the microphone and when it is captured. By default, `useIntegratedRecording` automatically compensates for this delay using `AudioContext.outputLatency` plus Tone.js scheduler lookahead (~0.1 s).

:::tip Try it live
The [recording example](/examples/recording) has a **Latency (s)** input in its toolbar — enter a value in seconds and record to apply the override, or leave it empty for the auto-computed value.
:::

### Overriding with a Measured Latency

If you have measured the actual round-trip latency of your audio interface (for example via a loopback test), you can supply that value directly with the `latencyOffset` option (in **seconds**):

```tsx
const recording = useIntegratedRecording(arrangement, selectedTrackId, {
  currentTime,
  latencyOffset: 0.023, // 23 ms externally-measured round-trip latency
});
```

**Semantics:**

| Value | Behaviour |
|-------|-----------|
| Omitted | Auto-computed value (`outputLatency` + Tone.js `lookAhead`) |
| `0` | Compensation disabled — clip starts at the recorded sample |
| Positive number | Absolute replacement for the auto-computed value (seconds) |
| Negative or non-finite | Treated as `0` (no compensation) |

`latencyOffset` is an **absolute replacement**, not an additive offset. Setting it to `0.023` always skips exactly 23 ms of captured audio, regardless of the hardware's `outputLatency`.

### Keeping Preview and Clip in Sync

The take is drawn while it is recorded by `<WaveformRecordingPreview>`, a child of `<WaveformTracks>` in your composition of the view. For the live preview to match the finalized clip, pass the **same** value to both `useIntegratedRecording` and the `latencyOffset` field of the preview's `recordingState`:

```tsx
import {
  WaveformRoot,
  WaveformTimescale,
  WaveformTrackControls,
  WaveformTracks,
  WaveformRecordingPreview,
  WaveformSelection,
  WaveformPlayhead,
  useRecordingSession,
} from '@waveform-playlist/browser';

const LATENCY = 0.023; // your measured latency, in seconds

const { isRecording, progress, recordingTrackId, ... } =
  useIntegratedRecording(arrangement, selectedTrackId, {
    currentTime,
    latencyOffset: LATENCY,
  });

// While the take runs: playback continues past the end of the audio, and the
// take's track plays muted (a punch-in replaces what it holds).
useRecordingSession({ isRecording, trackId: recordingTrackId });

<WaveformRoot>
  <WaveformTimescale />
  <WaveformTrackControls />
  <WaveformTracks>
    {isRecording && recordingTrackId ? (
      <WaveformRecordingPreview
        recordingState={{
          isRecording,
          // The track the take was started on (from useIntegratedRecording): the
          // take is added there even if another track is selected meanwhile.
          trackId: recordingTrackId,
          // startSample is derived by the consumer: the timeline position captured
          // when recording started — see the full recording example.
          startSample,
          // The take's elapsed time and peaks, as a source. Only the preview clip
          // follows it frame by frame; this component does not re-render.
          progress,
          bits: 16,
          latencyOffset: LATENCY, // must match the value above
        }}
      />
    ) : null}
  </WaveformTracks>
  <WaveformSelection />
  <WaveformPlayhead />
</WaveformRoot>
```

`<WaveformRecordingPreview>` only draws the take. [`useRecordingSession`](/docs/react/api/hooks#userecordingsession) is what tells the provider that a take is running; call it in the component that calls `useIntegratedRecording`, under `WaveformPlaylistProvider`. A handler that starts playback together with the recording (an overdub) should also call `useEditorControls().setRecordingActive(true, trackId)` before `play()`, because the hook's effect runs a render later.

### The Recorded Track Is Muted During the Take

While a take records, the arrangement marks the track as the one the take is recording onto (`arrangement.setTrackRecording`), which plays it muted for the take, so what it already holds does not play under the punch-in that replaces it:

- the mixer (`usePlaylistMixer().trackStates`) and the track's Mute button show it muted;
- the built-in `<TrackMuteButton />` of that track is disabled, and `useTrack().isRecording` is true for it, for a mute control of your own;
- the take's mute is not an undo step and does not change the track's own mute: `arrangement.getMixer()` keeps it, so a mute changed on that track during the take (a `setTrackMute`) stays after it;
- the take's mute is cleared when the take ends or the take's track changes, and when the provider unmounts or is hidden by `<Activity>` while a take is recording.

This is not a record-arm: it lasts only while a take is recorded, and the app does not set it.

Edges to know:

- A take started during the playlist's first load records without playback: `play()` does nothing before the first [ready](/docs/react/guides/loading-audio#ready).
- An `<Activity>` hide of the component that calls `useRecordingSession` ends the session (the take's mute is cleared). When that component also calls `useIntegratedRecording`, the hide ends the take as well: it is added to its track, and `isRecording` is `false` when the component is shown again. With `isRecording` from a component that was not hidden, the reveal mutes the track again.
- Removing the take's track during a take as an undo step: the end of the take still clears its take mute, so undoing the removal after the take brings the track back with its own mute. Undone during the take, the track comes back muted until the take ends.
- A mute control of your own that toggles from the reported value (`setMuted(!muted)`) during a take sets the track's own mute to false, because `muted` is true for the take: the track stays muted for the take and comes out of it unmuted. Disable it while `isRecording`, as the built-in button is.
- Only the built-in Mute button is disabled. Solo, volume and pan stay enabled.

If `latencyOffset` is omitted from `recordingState`, the preview uses the same auto-computed value as `useIntegratedRecording`.

---

## Download Recorded Audio

Recordings are captured as raw PCM audio using an AudioWorklet. After recording, the audio is available as an `AudioBuffer` which can be exported to WAV format.

Use the `ExportWavButton` component or the `useExportWav` hook to download recordings:

```tsx
import { ExportWavButton } from '@waveform-playlist/browser/tone';

function RecordingWithExport() {
  return (
    <WaveformPlaylistProvider arrangement={arrangement}>
      {/* Recording controls... */}
      <ExportWavButton
        label="Download Recording"
        filename="my-recording"
      />
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

Or use the hook for more control:

```tsx
import { usePlaylistTimeline, usePlaylistMixer } from '@waveform-playlist/browser';
import { useExportWav } from '@waveform-playlist/browser/tone';

function DownloadRecording() {
  const { tracks } = usePlaylistTimeline();
  const { trackStates } = usePlaylistMixer();
  const { exportWav, isExporting, progress } = useExportWav();

  const handleDownload = async () => {
    await exportWav(tracks, trackStates, {
      filename: `recording-${Date.now()}`,
      mode: 'master',  // or 'individual' for separate stems
      bitDepth: 16,
    });
  };

  return (
    <button onClick={handleDownload} disabled={isExporting || tracks.length === 0}>
      {isExporting ? `Exporting ${Math.round(progress * 100)}%` : 'Download Recording'}
    </button>
  );
}
```

## Recording Format

Recordings are captured using an AudioWorklet that processes raw PCM audio samples directly from the microphone. This approach provides:

- **Lossless quality** - No compression artifacts during capture
- **Sample-accurate timing** - Precise synchronization with other tracks
- **Real-time waveform** - Live visualization as you record
- **Seamless integration** - Recorded audio is added directly as playlist tracks

The AudioWorklet runs in a separate thread to ensure smooth recording without blocking the main UI thread.

### Export Options

When exporting recordings, you can choose:

| Option | Description |
|--------|-------------|
| `mode: 'master'` | Export all tracks as a mixdown (channel count matches source) |
| `mode: 'individual'` | Export a single track as a stem |
| `bitDepth: 16` | Standard CD quality (16-bit PCM) |
| `bitDepth: 32` | High resolution (32-bit float) |
| `applyEffects: true` | Include fades and effects in export |

## Complete Example

This example uses `useIntegratedRecording` for automatic track management. Recorded audio is automatically added as a clip to the selected track:

```tsx
import { useCallback, useState } from 'react';
import {
  WaveformPlaylistProvider,
  Waveform,
  WaveformViewOptions,
  PlayButton,
  PauseButton,
  StopButton,
  useCreateArrangement,
  useCurrentTime,
  useRecordingSession,
} from '@waveform-playlist/browser';
import { ExportWavButton } from '@waveform-playlist/browser/tone';
import { useIntegratedRecording, useRecordingProgress } from '@waveform-playlist/recording';
import { SegmentedVUMeter } from '@waveform-playlist/ui-components';
import { createTrack, type RecordingProgressSource } from '@waveform-playlist/core';
import type { Arrangement } from '@waveform-playlist/engine';

// Only this label re-renders as the take grows (10 times a second).
function ElapsedTime({ progress }: { progress: RecordingProgressSource }) {
  const { duration } = useRecordingProgress(progress);
  return <>{duration.toFixed(1)}s</>;
}

function RecordingControls({
  arrangement,
  selectedTrackId,
  onAddTrack,
}: {
  arrangement: Arrangement;
  selectedTrackId: string | null;
  onAddTrack: () => void;
}) {
  const { currentTime } = useCurrentTime();

  const {
    isRecording,
    meter,
    progress,
    stream,
    startRecording,
    stopRecording,
    requestMicAccess,
    recordingTrackId,
    error,
  } = useIntegratedRecording(arrangement, selectedTrackId, { currentTime });

  // Tell the playlist a take is running (see "Keeping Preview and Clip in Sync").
  useRecordingSession({ isRecording, trackId: recordingTrackId });

  const handleRecord = async () => {
    if (!stream) {
      // Records on the next press, once the stream is open.
      await requestMicAccess();
      return;
    }

    if (isRecording) {
      stopRecording(); // the take lands on its track: one undo step
    } else {
      // Refused (false, and `error` set) when no track is selected
      await startRecording();
    }
  };

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <button onClick={handleRecord} disabled={!isRecording && !selectedTrackId}>
        {isRecording ? (
          <>
            Stop (<ElapsedTime progress={progress} />)
          </>
        ) : (
          'Record'
        )}
      </button>
      <button onClick={onAddTrack}>+ Add Track</button>
      {stream && (
        <SegmentedVUMeter meter={meter} />
      )}
      {error && <span role="alert">{error.message}</span>}
    </div>
  );
}

function RecordingExample() {
  // Starts empty: a take lands on a track added with "+ Add Track"
  const arrangement = useCreateArrangement();
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  // addTrack is synchronous: the next take finds the track
  const handleAddTrack = useCallback(() => {
    const newTrack = createTrack({ name: `Track ${arrangement.getTracks().length + 1}` });
    arrangement.addTrack(newTrack);
    setSelectedTrackId(newTrack.id);
  }, [arrangement]);

  return (
    <WaveformPlaylistProvider arrangement={arrangement} samplesPerPixel={1024}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <PlayButton />
        <PauseButton />
        <StopButton />
        <ExportWavButton label="Export" filename="recording" />
      </div>
      <RecordingControls
        arrangement={arrangement}
        selectedTrackId={selectedTrackId}
        onAddTrack={handleAddTrack}
      />
      <WaveformViewOptions waveHeight={100}>
        <Waveform />
      </WaveformViewOptions>
    </WaveformPlaylistProvider>
  );
}

export default RecordingExample;
```

## AudioWorklet Setup

Recording uses [AudioWorklets](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet) for low-latency, sample-accurate audio capture and metering. The worklet files need to be served as separate JavaScript files that the browser loads at runtime.

### How It Works

The `@waveform-playlist/worklets` package (auto-installed with `@waveform-playlist/recording`) includes pre-built worklet files at:
```
node_modules/@waveform-playlist/worklets/dist/worklet/recording-processor.worklet.js
node_modules/@waveform-playlist/worklets/dist/worklet/meter-processor.worklet.js
```

The recording and metering hooks automatically resolve these files using `import.meta.url`, which works out of the box with modern bundlers that support ES modules.

### Bundler Configuration

#### Vite

Vite handles `import.meta.url` natively. No additional configuration needed.

#### Webpack 5

Add the worklet to your asset configuration:

```js
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.worklet\.(js|mjs)$/,
        type: 'asset/resource',
        generator: {
          filename: 'worklets/[name][ext]',
        },
      },
    ],
  },
};
```

#### Next.js

Next.js uses Webpack under the hood. Add to `next.config.js`:

```js
// next.config.js
module.exports = {
  webpack: (config) => {
    config.module.rules.push({
      test: /\.worklet\.(js|mjs)$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/worklets/[name][ext]',
      },
    });
    return config;
  },
};
```

### Troubleshooting

**"Failed to load recording processor" error:**

This usually means the worklet file couldn't be loaded. Check:

1. **Network tab**: Look for a 404 on `recording-processor.worklet.js`
2. **CORS**: The worklet must be served from the same origin or with proper CORS headers
3. **HTTPS**: AudioWorklet requires a secure context (HTTPS or localhost)

**"Module already registered" warning:**

This is harmless and occurs when the worklet is loaded multiple times (e.g., hot reloading during development). The hook handles this gracefully.

### Integrating third-party AudioWorklet code

Recording (and the rest of `@waveform-playlist/playout`) runs on a shared global audio context from `getGlobalContext()` / `getGlobalAudioContext()`. That context is Tone.js's, and its `rawContext` is **always** a [`standardized-audio-context`](https://github.com/chrisguttandin/standardized-audio-context) ponyfill — **not** a native `BaseAudioContext` / `AudioContext`. This is deliberate: the ponyfill normalizes cross-browser Web Audio differences (e.g. Firefox `AudioWorkletNode` / `AudioParam`).

Two consequences for third-party Web Audio code you run alongside the playlist:

- `getGlobalAudioContext() instanceof window.AudioContext` is `false`.
- The **native** `AudioWorkletNode` constructor rejects it — `new AudioWorkletNode(getGlobalAudioContext(), 'my-processor')` throws `TypeError: parameter 1 is not of type 'BaseAudioContext'` (same in Chrome and Firefox).

So don't hardcode the native constructor. Use the dependency-injection pattern from [`chrisguttandin/limiter-audio-worklet`](https://github.com/chrisguttandin/limiter-audio-worklet) — accept the `AudioWorkletNode` constructor and the module loader as parameters — or import `AudioWorkletNode` from `standardized-audio-context`, so your code works on a native **or** ponyfilled context. That is exactly what `@waveform-playlist/worklets` does:

```ts
// caller supplies addModule for whichever context type is in use
await addRecordingWorkletModule((url) => ctx.audioWorklet.addModule(url));
```

If you genuinely need a native `AudioContext`, own it yourself via the web-components surface (`@dawcore/*`), which uses native Web Audio rather than Tone.

## Browser Compatibility

Recording requires:
- `getUserMedia` API for microphone access
- `AudioWorklet` API for sample-accurate recording
- Secure context (HTTPS or localhost)

| Browser | Support |
|---------|---------|
| Chrome | Full support (66+) |
| Firefox | Full support (76+) |
| Safari | Safari 14.1+ |
| Edge | Full support (79+) |

## Next Steps

- [Annotations](/docs/react/guides/annotations) - Add annotations to recordings
- [Track Management](/docs/react/guides/track-management) - Manage recorded tracks
