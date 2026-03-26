# @dawcore/transport

Native Web Audio transport for multi-track audio scheduling, looping, tempo, and metronome. Zero npm dependencies.

## Features

- **Native Web Audio** — No Tone.js, no `standardized-audio-context`. Direct `AudioContext` with full `sampleRate` and `latencyHint` control.
- **Sliding window scheduler** — Schedules audio 200ms ahead via `requestAnimationFrame` for glitch-free playback.
- **Dual timeline** — Sample-absolute positions for audio clips, PPQN tick positions for metronome/MIDI.
- **Built-in metronome** — Beat-grid click scheduling with accent on beat 1. Default synthesized click sounds out of the box.
- **Count-in (pre-roll)** — Configurable bars of click sounds before playback begins. Beat-by-beat events for UI countdown.
- **Per-track signal chain** — Native GainNode (volume) → StereoPannerNode → GainNode (mute) → effects hook → master output.
- **Effects plugin hook** — `connectTrackOutput(trackId, node)` inserts any `AudioNode` chain (Tone.js effects, WAM plugins, native nodes).
- **Type-safe coordinates** — Branded `Tick` and `Sample` types prevent accidentally passing seconds where ticks or samples are expected. Zero runtime cost.
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

// Default click sounds are built in — just enable and play
transport.setMetronomeEnabled(true);
transport.play();

// Override with custom click sounds
transport.setMetronomeClickSounds(accentBuffer, normalBuffer);
```

### Count-In

```typescript
transport.setCountIn(true);
transport.setCountInBars(1);           // 1–8 bars, default 1
transport.setCountInMode('always');    // 'always' | 'recording-only' (default)

// Beat-by-beat events for UI countdown
transport.on('countIn', ({ beat, totalBeats }) => {
  console.log(beat + ' / ' + totalBeats);  // "1 / 4", "2 / 4", ...
});

transport.on('countInEnd', () => {
  console.log('Playback starting');
});

transport.play();  // Plays count-in clicks, then starts playback
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

### Tempo Automation

```typescript
const transport = new Transport(audioContext, { tempo: 100 });

// Linear ramp from 100 to 160 BPM over 8 bars
transport.setTempo(160, transport.barToTick(9), { interpolation: 'linear' });

// Query interpolated BPM at any position
transport.getTempo(transport.barToTick(5)); // 130 BPM (midway through ramp)

// Curved ramp: ease-in (slow start, fast end)
transport.clearTempos();
transport.setTempo(80);
transport.setTempo(160, transport.barToTick(9), {
  interpolation: { type: 'curve', slope: 0.2 },  // concave
});

// Curved ramp: ease-out (fast start, slow end)
transport.clearTempos();
transport.setTempo(80);
transport.setTempo(160, transport.barToTick(9), {
  interpolation: { type: 'curve', slope: 0.8 },  // convex
});

// Mix step and linear: jump to 80 BPM at bar 4, ramp to 140 at bar 8
transport.clearTempos();
transport.setTempo(120);
transport.setTempo(80, transport.barToTick(5));  // step (instant jump)
transport.setTempo(140, transport.barToTick(9), { interpolation: 'linear' });  // ramp
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
| `accentFrequency` | `1000` | Default accent click frequency (Hz) |
| `normalFrequency` | `800` | Default normal click frequency (Hz) |

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
- `setLoop(enabled, startTick: Tick, endTick: Tick)` — Set loop region in ticks (primary API)
- `setLoopSeconds(enabled, start, end)` — Set loop region in seconds (convenience)
- `setLoopSamples(enabled, startSample: Sample, endSample: Sample)` — Set loop region in samples (convenience)

**Tempo & Meter:**
- `setTempo(bpm, atTick?, options?)` / `getTempo(atTick?: Tick)` — options: `{ interpolation: 'step' | 'linear' | { type: 'curve', slope } }`
- `clearTempos()` — remove all tempo entries
- `setMeter(numerator, denominator, atTick?: Tick)` / `getMeter(atTick?: Tick)`
- `removeMeter(atTick: Tick)` / `clearMeters()`
- `barToTick(bar): Tick` / `tickToBar(tick: Tick)`
- `timeToTick(seconds): Tick` / `tickToTime(tick: Tick)`

**Metronome:**
- `setMetronomeEnabled(enabled)`
- `setMetronomeClickSounds(accent, normal)` — overrides default synthesized sounds

**Count-In:**
- `setCountIn(enabled)` — enable/disable count-in
- `setCountInBars(bars)` — number of bars (1–8, default 1)
- `setCountInMode(mode)` — `'recording-only'` (default) or `'always'`
- `setRecording(recording)` — consumer signals recording state (for `'recording-only'` mode)
- `isCountingIn()` — whether count-in is active

**Effects:**
- `connectTrackOutput(trackId, node)` — Insert effects chain
- `disconnectTrackOutput(trackId)` — Remove effects chain

**Events:**
- `on(event, callback)` / `off(event, callback)`
- Events: `play`, `pause`, `stop`, `loop`, `tempochange`, `meterchange`, `countIn`, `countInEnd`
- `tempochange` payload: `{ bpm: number, atTick: Tick }`
- `meterchange` payload: `{ numerator: number, denominator: number, atTick: Tick }`
- `countIn` payload: `{ beat: number, totalBeats: number }`

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

## How It Works

See [EDUCATIONAL.md](./EDUCATIONAL.md) for an in-depth explanation of the math and timing models behind audio transport systems.

## License

MIT
