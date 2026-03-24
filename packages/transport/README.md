# @dawcore/transport

Native Web Audio transport for multi-track audio scheduling, looping, tempo, and metronome. Zero npm dependencies.

## Features

- **Native Web Audio** — No Tone.js, no `standardized-audio-context`. Direct `AudioContext` with full `sampleRate` and `latencyHint` control.
- **Sliding window scheduler** — Schedules audio 200ms ahead via `requestAnimationFrame` for glitch-free playback.
- **Dual timeline** — Sample-absolute positions for audio clips, PPQN tick positions for metronome/MIDI.
- **Built-in metronome** — Beat-grid click scheduling with accent on beat 1. Just another scheduler listener.
- **Per-track signal chain** — Native GainNode (volume) → StereoPannerNode → GainNode (mute) → effects hook → master output.
- **Effects plugin hook** — `connectTrackOutput(trackId, node)` inserts any `AudioNode` chain (Tone.js effects, WAM plugins, native nodes).
- **PlayoutAdapter bridge** — `NativePlayoutAdapter` implements the `PlayoutAdapter` interface from `@waveform-playlist/engine`.

## Installation

```bash
npm install @dawcore/transport
```

Peer dependencies:
```bash
npm install @waveform-playlist/core @waveform-playlist/engine
```

## Quick Start

### Standalone Transport

```typescript
import { Transport } from '@dawcore/transport';

const audioContext = new AudioContext({ sampleRate: 48000, latencyHint: 0 });
const transport = new Transport(audioContext, { tempo: 120 });

transport.setTracks([
  {
    id: 'drums',
    name: 'Drums',
    clips: [{ id: 'clip-1', audioBuffer: drumBuffer, startSample: 0, durationSamples: 48000, offsetSamples: 0, sampleRate: 48000, sourceDurationSamples: 48000, gain: 1 }],
    volume: 1,
    pan: 0,
    muted: false,
    soloed: false,
  },
]);

transport.play();
```

### With PlaylistEngine (dawcore)

```typescript
import { NativePlayoutAdapter } from '@dawcore/transport';

const audioContext = new AudioContext({ sampleRate: 48000 });
const adapter = new NativePlayoutAdapter(audioContext);

// Use as daw-editor's adapter factory
const editor = document.querySelector('daw-editor');
editor.adapterFactory = () => new NativePlayoutAdapter(audioContext);
```

### Metronome

```typescript
const transport = new Transport(audioContext, {
  tempo: 120,
  numerator: 4,
  denominator: 4,
});

transport.setMetronomeEnabled(true);
transport.setMetronomeClickSounds(accentBuffer, normalBuffer);
transport.play();
```

### Mixed Meter

```typescript
const transport = new Transport(audioContext, { tempo: 120, numerator: 4, denominator: 4 });

// Switch to 7/8 at bar 5
transport.setMeter(7, 8, transport.barToTick(5));

// Query active meter at any tick
const { numerator, denominator } = transport.getMeter(transport.barToTick(5));
// → { numerator: 7, denominator: 8 }

transport.setMetronomeEnabled(true);
transport.play();
```

### Effects

```typescript
// Insert any AudioNode chain between track output and master
const reverb = audioContext.createConvolver();
reverb.buffer = impulseResponse;
reverb.connect(transport.audioContext.destination);

transport.connectTrackOutput('vocals', reverb);

// Remove effects — restores direct routing to master
transport.disconnectTrackOutput('vocals');
```

## API

### Transport

```typescript
new Transport(audioContext: AudioContext, options?: TransportOptions)
```

**TransportOptions:**
| Option | Default | Description |
|--------|---------|-------------|
| `sampleRate` | `audioContext.sampleRate` | Sample rate for timeline conversions |
| `ppqn` | `960` | Ticks per quarter note |
| `tempo` | `120` | Initial tempo in BPM |
| `numerator` | `4` | Beats per bar (time signature numerator) |
| `denominator` | `4` | Beat unit (time signature denominator) |
| `schedulerLookahead` | `0.2` | How far ahead to schedule (seconds) |

> **Note:** `beatsPerBar` is deprecated. Use `numerator`/`denominator` instead.

**Playback:**
- `play(startTime?, endTime?)` — Start or resume playback
- `pause()` — Pause, preserving position
- `stop()` — Stop and reset to beginning
- `seek(time)` — Jump to a position (works during playback)
- `getCurrentTime()` — Current transport position in seconds
- `isPlaying()` — Whether transport is playing

**Tracks:**
- `setTracks(tracks)` — Set all tracks (rebuilds audio graph)
- `addTrack(track)` — Add a single track
- `removeTrack(trackId)` — Remove a track
- `updateTrack(trackId, track)` — Update a track's clips

**Track Controls:**
- `setTrackVolume(trackId, volume)`
- `setTrackPan(trackId, pan)`
- `setTrackMute(trackId, muted)`
- `setTrackSolo(trackId, soloed)`
- `setMasterVolume(volume)`

**Loop:**
- `setLoop(enabled, start, end)` — Set loop region in seconds

**Tempo & Meter:**
- `setTempo(bpm, atTick?)` / `getTempo(atTick?)`
- `clearTempos()` — remove all tempo entries
- `setMeter(numerator, denominator, atTick?)` / `getMeter(atTick?)`
- `removeMeter(atTick)` / `clearMeters()`
- `barToTick(bar)` / `tickToBar(tick)`
- `setBeatsPerBar(beats)` _(deprecated — use `setMeter`)_

**Metronome:**
- `setMetronomeEnabled(enabled)`
- `setMetronomeClickSounds(accent, normal)`

**Effects:**
- `connectTrackOutput(trackId, node)` — Insert effects chain
- `disconnectTrackOutput(trackId)` — Remove effects chain

**Events:**
- `on(event, callback)` / `off(event, callback)`
- Events: `play`, `pause`, `stop`, `loop`, `tempochange`

**Cleanup:**
- `dispose()` — Stop playback, disconnect all nodes, remove listeners

### NativePlayoutAdapter

```typescript
new NativePlayoutAdapter(audioContext: AudioContext, options?: TransportOptions)
```

Implements `PlayoutAdapter` from `@waveform-playlist/engine`. All methods delegate to the internal `Transport` instance.

- `adapter.transport` — Direct access to the `Transport` for tempo, metronome, and effects APIs

## Architecture

See [TRANSPORT.md](./TRANSPORT.md) for the full architecture guide.

## License

MIT
