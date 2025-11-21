# @waveform-playlist/recording

Audio recording support for waveform-playlist using AudioWorklet.

## Features

- ✅ **AudioWorklet-based recording** - Low latency, direct PCM access
- ✅ **Real-time waveform visualization** - See the waveform as you record
- ✅ **React hooks** - Easy integration with React apps
- ✅ **Device selection** - Choose from available microphone inputs
- ✅ **Optional package** - Only include if you need recording

## Installation

```bash
npm install @waveform-playlist/recording
```

## Usage

### Basic Recording

```typescript
import { useRecording, useMicrophoneAccess, RecordButton } from '@waveform-playlist/recording';

function RecordingApp() {
  const { stream, requestAccess } = useMicrophoneAccess();
  const { isRecording, startRecording, stopRecording, peaks, duration } = useRecording(stream);

  const handleRecord = async () => {
    if (!stream) {
      await requestAccess();
    }

    if (isRecording) {
      const audioBuffer = await stopRecording();
      // Use the recorded audio buffer
    } else {
      await startRecording();
    }
  };

  return (
    <div>
      <RecordButton isRecording={isRecording} onClick={handleRecord} />
      <p>Duration: {duration.toFixed(1)}s</p>
      {/* Display waveform using peaks */}
    </div>
  );
}
```

### With Microphone Selection

```typescript
import {
  useMicrophoneAccess,
  useRecording,
  MicrophoneSelector,
  RecordButton,
  RecordingIndicator,
} from '@waveform-playlist/recording';

function RecordingApp() {
  const { stream, devices, requestAccess } = useMicrophoneAccess();
  const { isRecording, duration, startRecording, stopRecording } = useRecording(stream);
  const [selectedDevice, setSelectedDevice] = useState<string>();

  const handleDeviceChange = async (deviceId: string) => {
    setSelectedDevice(deviceId);
    await requestAccess(deviceId);
  };

  return (
    <div>
      <MicrophoneSelector
        devices={devices}
        selectedDeviceId={selectedDevice}
        onDeviceChange={handleDeviceChange}
      />
      <RecordButton
        isRecording={isRecording}
        onClick={isRecording ? stopRecording : startRecording}
      />
      <RecordingIndicator isRecording={isRecording} duration={duration} />
    </div>
  );
}
```

### Integration with WaveformPlaylist

```typescript
import { WaveformPlaylistProvider, Waveform } from '@waveform-playlist/browser';
import { useRecording, useMicrophoneAccess } from '@waveform-playlist/recording';

function RecordingPlaylist() {
  const { stream, requestAccess } = useMicrophoneAccess();
  const { peaks, audioBuffer, startRecording, stopRecording } = useRecording(stream);
  const [tracks, setTracks] = useState([]);

  const handleStopRecording = async () => {
    const buffer = await stopRecording();
    if (buffer) {
      // Add recorded track to playlist
      setTracks([
        ...tracks,
        {
          src: buffer,
          name: 'Recording',
        },
      ]);
    }
  };

  return (
    <WaveformPlaylistProvider tracks={tracks}>
      <button onClick={requestAccess}>Request Microphone</button>
      <button onClick={startRecording}>Record</button>
      <button onClick={handleStopRecording}>Stop</button>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

## API Reference

### Hooks

#### `useMicrophoneAccess()`

Manages microphone access and device enumeration.

**Returns:**
- `stream: MediaStream | null` - Active microphone stream
- `devices: MicrophoneDevice[]` - Available microphone devices
- `hasPermission: boolean` - Whether microphone permission is granted
- `isLoading: boolean` - Loading state during access request
- `requestAccess: (deviceId?: string) => Promise<void>` - Request microphone access
- `stopStream: () => void` - Stop the microphone stream
- `error: Error | null` - Error state

#### `useRecording(stream, options?)`

Main recording hook using AudioWorklet.

**Parameters:**
- `stream: MediaStream | null` - Microphone stream from `useMicrophoneAccess`
- `options?: RecordingOptions`
  - `sampleRate?: number` - Sample rate (defaults to AudioContext rate)
  - `channelCount?: number` - Number of channels (default: 1)
  - `samplesPerPixel?: number` - Samples per pixel for peaks (default: 1024)

**Returns:**
- `isRecording: boolean` - Whether recording is active
- `isPaused: boolean` - Whether recording is paused
- `duration: number` - Recording duration in seconds
- `peaks: number[]` - Peak data for waveform visualization
- `audioBuffer: AudioBuffer | null` - Final recorded audio buffer
- `startRecording: () => Promise<void>` - Start recording
- `stopRecording: () => Promise<AudioBuffer | null>` - Stop and finalize recording
- `pauseRecording: () => void` - Pause recording
- `resumeRecording: () => void` - Resume recording
- `error: Error | null` - Error state

### Components

#### `<RecordButton />`

Button for starting/stopping recording.

**Props:**
- `isRecording: boolean` - Recording state
- `onClick: () => void` - Click handler
- `disabled?: boolean` - Disabled state
- `className?: string` - CSS class name

#### `<MicrophoneSelector />`

Dropdown for selecting microphone device.

**Props:**
- `devices: MicrophoneDevice[]` - Available devices
- `selectedDeviceId?: string` - Currently selected device
- `onDeviceChange: (deviceId: string) => void` - Change handler
- `disabled?: boolean` - Disabled state
- `className?: string` - CSS class name

#### `<RecordingIndicator />`

Visual indicator showing recording status and duration.

**Props:**
- `isRecording: boolean` - Recording state
- `isPaused?: boolean` - Paused state
- `duration: number` - Duration in seconds
- `formatTime?: (seconds: number) => string` - Custom time formatter
- `className?: string` - CSS class name

## Architecture

The recording implementation uses AudioWorklet for low-latency audio capture:

```
getUserMedia → MediaStream
                    ↓
        MediaStreamSource (Web Audio)
                    ↓
          AudioWorklet Processor
          (captures raw PCM data)
                    ↓
        Main Thread (React Hook)
          - Accumulates audio data
          - Generates peaks in real-time
          - Updates waveform visualization
                    ↓
         Final AudioBuffer
```

## Browser Support

- Chrome 66+
- Firefox 76+
- Edge 79+
- Safari 14.1+

Requires HTTPS or localhost for microphone access.

## License

MIT
