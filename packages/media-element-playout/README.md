# @waveform-playlist/media-element-playout

A lightweight, HTMLMediaElement-based playout engine for waveform-playlist with **pitch-preserving playback rate control**.

## Features

- **Pitch-preserving playback rate** (0.5x - 2.0x) - uses browser's built-in time-stretching
- **Pre-computed peaks** - no AudioBuffer decoding required, instant visualization
- **Lightweight** - no Tone.js dependency
- **Simple API** - designed for single-track playback use cases

## When to Use

Use `MediaElementPlayout` when you need:
- Playback speed control for language learning, podcasts, etc.
- Single-track playback with minimal overhead
- Quick load times with pre-computed peaks

Use `TonePlayout` from `@waveform-playlist/playout` when you need:
- Multi-track mixing and editing
- Clip-level effects and fades
- Precise sample-accurate timing

## Installation

```bash
npm install @waveform-playlist/media-element-playout
```

## Usage

```typescript
import { MediaElementPlayout } from '@waveform-playlist/media-element-playout';
import WaveformData from 'waveform-data';

// Load pre-computed peaks
const response = await fetch('/audio/podcast.dat');
const arrayBuffer = await response.arrayBuffer();
const peaks = WaveformData.create(arrayBuffer);

// Create playout
const playout = new MediaElementPlayout({
  masterVolume: 1.0,
  playbackRate: 1.0,
});

// Add a track
playout.addTrack({
  source: '/audio/podcast.mp3',  // URL or Blob URL
  peaks: peaks,
  name: 'Podcast Episode 1',
});

// Control playback
playout.play(0);           // Play from beginning
playout.setPlaybackRate(0.75);  // Slow down to 75% speed (pitch preserved)
playout.pause();
playout.seekTo(30);        // Seek to 30 seconds
playout.play();            // Resume

// Clean up
playout.dispose();
```

## API

### MediaElementPlayout

```typescript
interface MediaElementPlayoutOptions {
  masterVolume?: number;  // 0.0 to 1.0 (default: 1.0)
  playbackRate?: number;  // 0.5 to 2.0 (default: 1.0)
}

class MediaElementPlayout {
  // Lifecycle
  init(): Promise<void>;  // No-op for media element
  dispose(): void;

  // Track management
  addTrack(options: MediaElementTrackOptions): MediaElementTrack;
  removeTrack(trackId: string): void;
  getTrack(trackId: string): MediaElementTrack | undefined;

  // Playback
  play(when?: number, offset?: number, duration?: number): void;
  pause(): void;
  stop(): void;
  seekTo(time: number): void;
  getCurrentTime(): number;

  // Volume & Rate
  setMasterVolume(volume: number): void;
  setPlaybackRate(rate: number): void;  // 0.5 to 2.0, pitch preserved

  // State
  readonly isPlaying: boolean;
  readonly duration: number;
  readonly playbackRate: number;
}
```

### MediaElementTrack

```typescript
interface MediaElementTrackOptions {
  source: string | HTMLAudioElement;  // URL or audio element
  peaks?: WaveformDataObject;         // Pre-computed peaks (optional — omit for scrubber-only / headless players)
  id?: string;
  name?: string;
  volume?: number;
  playbackRate?: number;
}
```

## Generating Peaks

Use [audiowaveform](https://github.com/bbc/audiowaveform) or [waveform-data.js](https://github.com/bbc/waveform-data.js) to pre-compute peaks:

```bash
# Generate peaks file with audiowaveform
audiowaveform -i audio.mp3 -o peaks.dat -b 16
```

## Browser Support

Pitch-preserving playback rate is supported in:
- Chrome 77+
- Firefox 20+
- Safari 14.1+
- Edge 79+

Older browsers will still work but may change pitch with speed.

## License

MIT
