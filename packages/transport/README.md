# @dawcore/transport

Native Web Audio transport for the dawcore family — multi-track scheduling, looping, tempo automation, time signatures, and metronome. No Tone.js, zero npm dependencies.

## Features

- **Native Web Audio** — No Tone.js, no `standardized-audio-context`. Direct `AudioContext` with full `sampleRate` and `latencyHint` control.
- **Sliding window scheduler** — Schedules audio 200ms ahead via `requestAnimationFrame` for glitch-free playback.
- **Dual timeline** — Sample-absolute positions for audio clips, PPQN tick positions for metronome/MIDI.
- **Built-in metronome** — Beat-grid click scheduling with accent on beat 1. Default synthesized click sounds out of the box.
- **Count-in (pre-roll)** — Configurable bars of click sounds before playback begins. Beat-by-beat events for UI countdown.
- **Per-track signal chain** — Native GainNode (volume) → StereoPannerNode → GainNode (mute) → effects hook → master output.
- **Effects plugin hook** — `connectTrackOutput(trackId, node)` and `connectMasterOutput(node)` insert any `AudioNode` chain (Tone.js effects, WAM plugins, native nodes) per-track or on the master bus.
- **Type-safe coordinates** — Branded `Tick` and `Sample` types prevent accidentally passing seconds where ticks or samples are expected. Zero runtime cost.
- **PlayoutAdapter bridge** — `NativePlayoutAdapter` implements the `PlayoutAdapter` interface from `@waveform-playlist/engine`.

## Installation

```bash
npm install @dawcore/transport
```

No runtime dependencies. When using `NativePlayoutAdapter` (bridge to `@waveform-playlist/engine`), install `@waveform-playlist/core` and `@waveform-playlist/engine` alongside.

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

// Use as daw-editor's playout adapter
const editor = document.querySelector('daw-editor');
editor.adapter = adapter;

// Transport-specific APIs stay available on your adapter reference
adapter.transport.setMetronomeEnabled(true);
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

// Master bus effects — inserted between master gain and destination
const compressor = audioContext.createDynamicsCompressor();
compressor.connect(audioContext.destination);

transport.connectMasterOutput(compressor);

// Remove master effects — restores direct routing to destination.
// Parallel taps on transport.masterOutputNode (analyzers, recorders)
// are unaffected by connect/disconnect.
transport.disconnectMasterOutput();
```

**Note:** `ClipTrack.effects` (the Tone.js-oriented per-track effects function used by `@waveform-playlist/playout`) is not read by `NativePlayoutAdapter` — it's silently ignored. Use `connectTrackOutput`/`connectMasterOutput` for effects with the native transport, or use `TonePlayoutAdapter` if a track still relies on `ClipTrack.effects`.

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
- `setTempo(bpm, atTick?, options?)` / `getTempo(atTick?: Tick)` — options: `{ interpolation: 'step' | 'linear' | { type: 'curve', slope } }`. Returns `boolean`: a defaulted `atTick` is the single-BPM convenience path and is refused (with a warning) when the tempo map has more than one entry — pass an explicit `atTick` to modify a tempo curve.
- `removeTempo(atTick: Tick)` — remove the tempo entry at a tick (the tick-0 entry cannot be removed)
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
- `connectTrackOutput(trackId, node)` — Insert per-track effects chain
- `disconnectTrackOutput(trackId)` — Remove per-track effects chain
- `connectMasterOutput(node)` — Insert master bus effects chain
- `disconnectMasterOutput()` — Remove master bus effects chain
- `masterOutputNode` (getter) — Master gain node, for parallel taps (analyzers, recorders) that should survive chain connect/disconnect

**Events:**
- `on(event, callback)` / `off(event, callback)`
- Events: `play`, `pause`, `stop`, `seek`, `loop`, `tempochange`, `meterchange`, `countIn`, `countInEnd`
- `seek` payload: `{ seconds: number }`
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

- `adapter.transport` — Direct access to the `Transport` for tempo, metronome, count-in, and effects APIs
- `adapter.ppqn` — Tick resolution, read by the engine on construction
- `adapter.masterOutputNode` — Master gain node for parallel taps (analyzers, recorders)
- `adapter.init()` — Resumes a suspended AudioContext and waits for the hardware pipeline to warm up (Safari needs this before clips scheduled at time 0 play on time)
- `setTempo(bpm, atTick?)`, `setMeter(numerator, denominator, atTick?)`, `ticksToSeconds(tick)`, `secondsToTicks(seconds)` — tempo/meter surface the engine uses for tick-based timeline math

### Advanced (Low-Level Building Blocks)

For consumers assembling a custom scheduler or embedding transport internals elsewhere, the layers underneath `Transport` are also exported: `Clock`, `Scheduler`, `Timer`, `SampleTimeline`, `TempoMap`, `MeterMap`, `MasterNode`, `TrackNode`, `ClipPlayer`, `MetronomePlayer`. See [`src/index.ts`](https://github.com/naomiaro/waveform-playlist/blob/main/packages/transport/src/index.ts) for the full export list — most consumers only need `Transport` and `NativePlayoutAdapter`.

## Examples

[`examples/dawcore-native/`](https://github.com/naomiaro/waveform-playlist/tree/main/examples/dawcore-native) pairs this transport with the `@dawcore/components` editor: metronome, tempo automation, mixed meter, beat-map grids, effects, and recording pages (`pnpm example:dawcore-native`).

## Architecture

See [TRANSPORT.md](https://github.com/naomiaro/waveform-playlist/blob/main/packages/transport/TRANSPORT.md) for the full architecture guide.

## How It Works

See [EDUCATIONAL.md](https://github.com/naomiaro/waveform-playlist/blob/main/packages/transport/EDUCATIONAL.md) for an in-depth explanation of the math and timing models behind audio transport systems.

## Documentation

Full guides at [naomiaro.github.io/waveform-playlist](https://naomiaro.github.io/waveform-playlist/).

## License

MIT
