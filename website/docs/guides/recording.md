---
sidebar_position: 5
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
  const { isRecording, startRecording, stopRecording, recordedBlob } = useRecording();
  const { requestAccess, hasAccess } = useMicrophoneAccess();

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

The main hook for recording functionality:

```tsx
import { useRecording } from '@waveform-playlist/recording';

function RecordingControls() {
  const {
    isRecording,
    isPaused,
    duration,
    recordedBlob,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
  } = useRecording();

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

      {recordedBlob && (
        <button onClick={clearRecording}>Clear Recording</button>
      )}
    </div>
  );
}
```

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

After recording, add the audio as a new track:

```tsx
import { useRecording } from '@waveform-playlist/recording';
import { usePlaylistControls, useAudioTracks } from '@waveform-playlist/browser';

function RecordToPlaylist() {
  const { recordedBlob, stopRecording, isRecording, startRecording } = useRecording();
  const { addTrack } = usePlaylistControls();

  const handleStopAndAdd = async () => {
    stopRecording();

    // Wait for blob to be available
    if (recordedBlob) {
      const blobUrl = URL.createObjectURL(recordedBlob);
      const { tracks } = await useAudioTracks([
        { src: blobUrl, name: `Recording ${new Date().toLocaleTimeString()}` },
      ]);

      if (tracks.length > 0) {
        addTrack(tracks[0]);
      }
    }
  };

  return (
    <button onClick={isRecording ? handleStopAndAdd : startRecording}>
      {isRecording ? 'Stop & Add to Playlist' : 'Start Recording'}
    </button>
  );
}
```

## Download Recorded Audio

Save the recording to a file:

```tsx
function DownloadRecording() {
  const { recordedBlob } = useRecording();

  const handleDownload = () => {
    if (!recordedBlob) return;

    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button onClick={handleDownload} disabled={!recordedBlob}>
      Download Recording
    </button>
  );
}
```

## Recording Format

Recordings are captured in WebM format with Opus codec by default. This provides:
- Good compression
- Wide browser support
- Low latency encoding

For WAV output, convert the blob:

```tsx
async function convertToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Encode to WAV...
  // (Use a library like audiobuffer-to-wav)
}
```

## Complete Example

```tsx
import { useState } from 'react';
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  useAudioTracks,
  usePlaylistControls,
} from '@waveform-playlist/browser';
import {
  RecordingProvider,
  useRecording,
  useMicrophoneAccess,
  useMicrophoneLevel,
} from '@waveform-playlist/recording';

function LevelMeter() {
  const { level } = useMicrophoneLevel();

  return (
    <div style={{ width: '200px', height: '20px', background: '#ddd' }}>
      <div
        style={{
          width: `${level * 100}%`,
          height: '100%',
          background: level > 0.9 ? 'red' : 'green',
        }}
      />
    </div>
  );
}

function RecordingControls() {
  const { hasAccess, requestAccess } = useMicrophoneAccess();
  const { isRecording, duration, startRecording, stopRecording, recordedBlob } =
    useRecording();
  const { addTrack } = usePlaylistControls();

  const handleRecord = async () => {
    if (!hasAccess) {
      await requestAccess();
    }
    startRecording();
  };

  const handleStop = async () => {
    stopRecording();
  };

  const handleAddToPlaylist = async () => {
    if (recordedBlob) {
      const blobUrl = URL.createObjectURL(recordedBlob);
      const { tracks } = await useAudioTracks([
        { src: blobUrl, name: `Recording ${new Date().toLocaleTimeString()}` },
      ]);
      if (tracks.length > 0) {
        addTrack(tracks[0]);
      }
    }
  };

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      {!isRecording ? (
        <button onClick={handleRecord}>Record</button>
      ) : (
        <button onClick={handleStop}>Stop ({duration.toFixed(1)}s)</button>
      )}
      {isRecording && <LevelMeter />}
      {recordedBlob && (
        <button onClick={handleAddToPlaylist}>Add to Playlist</button>
      )}
    </div>
  );
}

function RecordingExample() {
  const { tracks, loading } = useAudioTracks([
    { src: '/audio/backing-track.mp3', name: 'Backing Track' },
  ]);

  if (loading) return <div>Loading...</div>;

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      samplesPerPixel={1024}
      waveHeight={100}
      timescale
    >
      <RecordingProvider>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <PlayButton />
          <PauseButton />
          <StopButton />
        </div>
        <RecordingControls />
        <Waveform />
      </RecordingProvider>
    </WaveformPlaylistProvider>
  );
}

export default RecordingExample;
```

## Browser Compatibility

Recording requires:
- `getUserMedia` API
- `MediaRecorder` API
- Secure context (HTTPS or localhost)

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Safari 14.1+ |
| Edge | Full support |

## Next Steps

- [Annotations](/guides/annotations) - Add annotations to recordings
- [Track Management](/guides/track-management) - Manage recorded tracks
