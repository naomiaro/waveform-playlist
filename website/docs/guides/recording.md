---
sidebar_position: 7
---

# Recording

Record audio directly from the microphone with level monitoring and waveform visualization.

## Installation

Install the recording package:

```bash npm2yarn
npm install @waveform-playlist/recording@next
```

## Basic Recording

```tsx
import { useState } from 'react';
import {
  WaveformPlaylistProvider,
  Waveform,
  useAudioTracks,
} from '@waveform-playlist/browser';
import {
  RecordingProvider,
  useRecording,
  useMicrophoneAccess,
} from '@waveform-playlist/recording';

function RecordButton() {
  const { requestAccess, hasAccess, stream } = useMicrophoneAccess();
  const { isRecording, startRecording, stopRecording } = useRecording(stream);

  const handleRecord = async () => {
    if (!hasAccess) {
      await requestAccess();
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
  const { tracks } = useAudioTracks([]);

  return (
    <WaveformPlaylistProvider tracks={tracks} timescale>
      <RecordingProvider>
        <RecordButton />
        <Waveform />
      </RecordingProvider>
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
    hasAccess,
    isRequesting,
    error,
    requestAccess,
    revokeAccess,
  } = useMicrophoneAccess();

  if (isRequesting) {
    return <div>Requesting microphone access...</div>;
  }

  if (error) {
    return <div>Microphone error: {error}</div>;
  }

  return (
    <div>
      <p>Microphone access: {hasAccess ? 'Granted' : 'Not granted'}</p>
      {!hasAccess ? (
        <button onClick={requestAccess}>Grant Microphone Access</button>
      ) : (
        <button onClick={revokeAccess}>Revoke Access</button>
      )}
    </div>
  );
}
```

### Audio Constraints

Customize microphone settings:

```tsx
const { requestAccess } = useMicrophoneAccess({
  audioConstraints: {
    echoCancellation: false,     // Preserve raw audio
    noiseSuppression: false,     // No processing
    autoGainControl: false,      // Manual gain control
    sampleRate: 48000,           // Higher sample rate
  },
});
```

Default constraints optimize for recording quality:

| Constraint | Default | Purpose |
|------------|---------|---------|
| `echoCancellation` | `false` | Preserve raw audio |
| `noiseSuppression` | `false` | No processing artifacts |
| `autoGainControl` | `false` | Consistent levels |
| `latency` | `0` | Low latency monitoring |

## Recording Controls

### useRecording Hook

The main hook for recording functionality. It requires a `MediaStream` from `useMicrophoneAccess`:

```tsx
import { useRecording, useMicrophoneAccess } from '@waveform-playlist/recording';

function RecordingControls() {
  const { stream } = useMicrophoneAccess();
  const {
    isRecording,
    isPaused,
    duration,
    audioBuffer,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  } = useRecording(stream);

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

Display real-time input levels:

```tsx
import { useMicrophoneLevel } from '@waveform-playlist/recording';

function LevelMeter() {
  const { level, peak } = useMicrophoneLevel();

  // level: 0-1 (current RMS level)
  // peak: 0-1 (peak level with decay)

  return (
    <div style={{ display: 'flex', gap: '1rem' }}>
      <div>
        <label>Level</label>
        <div
          style={{
            width: '200px',
            height: '20px',
            background: '#ddd',
          }}
        >
          <div
            style={{
              width: `${level * 100}%`,
              height: '100%',
              background: level > 0.9 ? 'red' : level > 0.7 ? 'yellow' : 'green',
              transition: 'width 50ms',
            }}
          />
        </div>
      </div>
      <div>
        <label>Peak</label>
        <div
          style={{
            width: '200px',
            height: '20px',
            background: '#ddd',
          }}
        >
          <div
            style={{
              width: `${peak * 100}%`,
              height: '100%',
              background: peak > 0.9 ? 'red' : '#333',
            }}
          />
        </div>
      </div>
    </div>
  );
}
```

### Clipping Indicator

Warn users when audio is too loud:

```tsx
function ClippingIndicator() {
  const { peak } = useMicrophoneLevel();
  const isClipping = peak > 0.95;

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

For multi-track recording with automatic track management, use the `useIntegratedRecording` hook from `@waveform-playlist/browser`:

```tsx
import { useIntegratedRecording } from '@waveform-playlist/browser';
import type { ClipTrack } from '@waveform-playlist/core';

function RecordToPlaylist() {
  const [tracks, setTracks] = useState<ClipTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  const {
    isRecording,
    startRecording,
    stopRecording,
    requestMicAccess,
    hasPermission,
  } = useIntegratedRecording(tracks, setTracks, selectedTrackId);

  const handleRecord = async () => {
    if (!hasPermission) {
      await requestMicAccess();
    }

    if (isRecording) {
      // Stop recording - clip is automatically added to the selected track
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <button onClick={handleRecord}>
      {isRecording ? 'Stop & Add to Playlist' : 'Start Recording'}
    </button>
  );
}
```

## Download Recorded Audio

Recordings are captured as raw PCM audio using an AudioWorklet. After recording, the audio is available as an `AudioBuffer` which can be exported to WAV format.

Use the `ExportWavButton` component or the `useExportWav` hook to download recordings:

```tsx
import { ExportWavButton } from '@waveform-playlist/browser';

function RecordingWithExport() {
  return (
    <WaveformPlaylistProvider tracks={tracks}>
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
import { useExportWav, usePlaylistData } from '@waveform-playlist/browser';

function DownloadRecording() {
  const { tracks, trackStates } = usePlaylistData();
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
| `mode: 'master'` | Export all tracks mixed to stereo |
| `mode: 'individual'` | Export a single track as a stem |
| `bitDepth: 16` | Standard CD quality (16-bit PCM) |
| `bitDepth: 32` | High resolution (32-bit float) |
| `applyEffects: true` | Include fades and effects in export |

## Complete Example

This example uses `useIntegratedRecording` for automatic track management. Recorded audio is automatically added as a clip to the selected track:

```tsx
import { useState } from 'react';
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  ExportWavButton,
  useIntegratedRecording,
  usePlaybackAnimation,
} from '@waveform-playlist/browser';
import { VUMeter } from '@waveform-playlist/recording';
import { createTrack, type ClipTrack } from '@waveform-playlist/core';

function RecordingControls({
  tracks,
  setTracks,
  selectedTrackId,
  setSelectedTrackId,
}: {
  tracks: ClipTrack[];
  setTracks: (tracks: ClipTrack[]) => void;
  selectedTrackId: string | null;
  setSelectedTrackId: (id: string | null) => void;
}) {
  const { currentTime } = usePlaybackAnimation();

  const {
    isRecording,
    duration,
    level,
    peakLevel,
    hasPermission,
    startRecording,
    stopRecording,
    requestMicAccess,
  } = useIntegratedRecording(tracks, setTracks, selectedTrackId, { currentTime });

  const handleAddTrack = () => {
    const newTrack = createTrack({
      name: `Track ${tracks.length + 1}`,
      clips: [],
    });
    setTracks([...tracks, newTrack]);
    setSelectedTrackId(newTrack.id);
  };

  const handleRecord = async () => {
    if (!hasPermission) {
      await requestMicAccess();
    }

    if (isRecording) {
      stopRecording();
    } else {
      // Create track if none selected
      if (!selectedTrackId) {
        handleAddTrack();
      }
      startRecording();
    }
  };

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <button onClick={handleRecord}>
        {isRecording ? `Stop (${duration.toFixed(1)}s)` : 'Record'}
      </button>
      <button onClick={handleAddTrack}>+ Add Track</button>
      {hasPermission && (
        <VUMeter level={level} peakLevel={peakLevel} width={200} height={20} />
      )}
    </div>
  );
}

function RecordingExample() {
  const [tracks, setTracks] = useState<ClipTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      samplesPerPixel={1024}
      waveHeight={100}
      timescale
      controls={{ show: true, width: 200 }}
    >
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <PlayButton />
        <PauseButton />
        <StopButton />
        <ExportWavButton label="Export" filename="recording" />
      </div>
      <RecordingControls
        tracks={tracks}
        setTracks={setTracks}
        selectedTrackId={selectedTrackId}
        setSelectedTrackId={setSelectedTrackId}
      />
      <Waveform />
    </WaveformPlaylistProvider>
  );
}

export default RecordingExample;
```

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

- [Annotations](/docs/guides/annotations) - Add annotations to recordings
- [Track Management](/docs/guides/track-management) - Manage recorded tracks
