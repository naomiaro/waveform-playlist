---
sidebar_position: 10
description: "Load MIDI files for piano roll visualization with SoundFont or synthesized playback"
---

# MIDI Playback

Waveform Playlist supports MIDI file loading and playback through the optional `@waveform-playlist/midi` package. MIDI tracks render as piano roll visualizations and play back using SoundFont samples or Tone.js PolySynth synthesis.

## Installation

```bash
npm install @waveform-playlist/midi @tonejs/midi
```

`@tonejs/midi` is a regular dependency and will be installed automatically. The package is separate from the core library so users who only need audio don't pay the bundle cost (~8-12 KB gzipped).

## Basic Usage

Use the `useMidiTracks` hook to load `.mid` files:

```tsx
import { useMidiTracks } from '@waveform-playlist/midi';
import { WaveformPlaylistProvider, Waveform, PlayButton, StopButton } from '@waveform-playlist/browser';

function MidiPlayer() {
  const { tracks, loading, error } = useMidiTracks(
    [{ src: '/music/song.mid' }],
    { sampleRate: 48000 },
  );

  if (loading) return <div>Loading MIDI...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <WaveformPlaylistProvider tracks={tracks} controls={{ show: true, width: 200 }}>
      <PlayButton /> <StopButton />
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

A single `.mid` file typically produces multiple `ClipTrack` objects — one per MIDI channel (e.g., Piano, Bass, Drums). All tracks are returned at once after loading completes.

## MidiTrackConfig Options

```typescript
interface MidiTrackConfig {
  src?: string;               // URL to .mid file
  midiNotes?: MidiNoteData[]; // Pre-parsed notes (skip fetch+parse)
  name?: string;              // Track display name
  muted?: boolean;
  soloed?: boolean;
  volume?: number;            // Default: 1.0
  pan?: number;               // Default: 0
  color?: string;
  startTime?: number;         // Clip position in seconds (default: 0)
  duration?: number;          // Override clip duration in seconds
  flatten?: boolean;          // Merge all MIDI tracks into one (default: false)
}

interface UseMidiTracksOptions {
  sampleRate: number;         // Required — pass AudioContext.sampleRate
}
```

### Pre-Parsed Notes

If you already have note data (e.g., from a custom parser or algorithm), skip the fetch step:

```tsx
const { tracks } = useMidiTracks(
  [
    {
      midiNotes: [
        { midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 },
        { midi: 64, name: 'E4', time: 0.5, duration: 0.5, velocity: 0.7 },
      ],
      name: 'Melody',
      duration: 4,
    },
  ],
  { sampleRate: 48000 },
);
```

### Flatten Mode

By default, each MIDI channel becomes a separate track. Use `flatten: true` to merge all channels into one visual track:

```tsx
const { tracks } = useMidiTracks(
  [{ src: '/music/song.mid', flatten: true }],
  { sampleRate: 48000 },
);
```

## SoundFont Playback

For realistic instrument sounds, load a SoundFont file and pass the cache to the provider:

```tsx
import { SoundFontCache } from '@waveform-playlist/playout';

// Load the SoundFont (do this once, e.g., in a hook or effect)
const cache = new SoundFontCache();
await cache.load('/soundfonts/piano.sf2');

// Pass to provider — MIDI tracks automatically use the SoundFont samples
<WaveformPlaylistProvider
  tracks={tracks}
  soundFontCache={cache}
>
  <Waveform />
</WaveformPlaylistProvider>
```

Without a `soundFontCache`, MIDI tracks fall back to Tone.js PolySynth synthesis. SoundFont playback uses the `midiProgram` field on each clip to select the correct instrument samples.

## Mixing MIDI and Audio Tracks

MIDI and audio tracks can be played together. Both `useMidiTracks` and `useAudioTracks` return `ClipTrack[]`, so merge them into a single array:

```tsx
import { useMidiTracks } from '@waveform-playlist/midi';
import { useAudioTracks, WaveformPlaylistProvider, Waveform } from '@waveform-playlist/browser';

function MixedPlayer() {
  const { tracks: midiTracks, loading: midiLoading } = useMidiTracks(
    [{ src: '/music/song.mid' }],
    { sampleRate: 48000 },
  );

  const { tracks: audioTracks, loading: audioLoading } = useAudioTracks([
    { src: '/audio/vocals.mp3', name: 'Vocals' },
  ]);

  if (midiLoading || audioLoading) return <div>Loading...</div>;

  const allTracks = [...midiTracks, ...audioTracks];

  return (
    <WaveformPlaylistProvider tracks={allTracks}>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

## Pure Parsing (No React)

The `parseMidiFile` function works without React — useful for Node.js scripts or non-React apps:

```typescript
import { parseMidiFile } from '@waveform-playlist/midi';

const response = await fetch('/music/song.mid');
const buffer = await response.arrayBuffer();
const parsed = parseMidiFile(buffer);

console.log(parsed.name);           // Song name
console.log(parsed.bpm);            // Tempo
console.log(parsed.tracks.length);  // Number of tracks

for (const track of parsed.tracks) {
  console.log(track.name, track.notes.length, 'notes');
}
```

There's also `parseMidiUrl` for a fetch+parse convenience:

```typescript
import { parseMidiUrl } from '@waveform-playlist/midi';

const parsed = await parseMidiUrl('/music/song.mid');
```

## Track Naming

Track names are derived from the MIDI file content:

- **Channel 9** → "Drums" (GM percussion convention)
- **Program > 0** → Title-cased GM instrument name (e.g., "Electric Bass (Finger)")
- **Program 0** → Track name from the MIDI file, or "Acoustic Grand Piano", or "Channel N"

When loading user-dropped files with a config `name`, individual track names from the MIDI file are used directly (not prefixed with the config name).
