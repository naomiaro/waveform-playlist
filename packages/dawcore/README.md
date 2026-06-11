# @dawcore/components

Framework-agnostic Web Components for multi-track audio editing. Drop `<daw-editor>` into any HTML page — no React, no build step required.

## Features

- **Pure Web Components** — Works with vanilla HTML, React, Vue, Svelte, or any framework
- **Declarative tracks** — `<daw-track>` and `<daw-clip>` elements define your timeline in HTML
- **Canvas waveforms** — Chunked rendering with virtual scrolling for large timelines
- **Drag interactions** — Move clips, trim boundaries, split at playhead
- **Keyboard shortcuts** — Play/pause, split, undo/redo via `<daw-keyboard-shortcuts>`
- **Undo/redo** — Full transaction-based undo with Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z
- **File drop** — Drag audio files onto the editor to add tracks (enable with the `file-drop` attribute)
- **Recording** — Live mic recording with waveform preview, pause/resume, cancelable clip creation
- **Pre-computed peaks** — Instant waveform rendering from `.dat` files before audio decodes
- **MIDI tracks** — Declarative or programmatic MIDI clips render as piano-roll. Playback via the Tone.js adapter. See [MIDI Tracks](#midi-tracks).
- **MIDI file loading** — `editor.loadMidi(urlOrFile)` parses a `.mid` file into piano-roll tracks via the optional `@dawcore/midi` peer
- **Spectrogram rendering** — `<daw-track render-mode="spectrogram">` renders FFT spectrograms via `@dawcore/spectrogram`
- **Track controls** — Volume, pan, mute, solo per track via `<daw-track-controls>`
- **Effects chains** — Per-track and master effect chains with built-in `native-*` effects, WAM 2.0 plugins via `@dawcore/wam`, and in-browser-compiled Faust DSP via `@dawcore/faust`. See [Effects](#effects).
- **Effect GUIs and persistence** — Mount plugin GUIs into your own panels; snapshot and restore whole chains. See [Effect GUIs](#effect-guis) and [Effects Persistence](#effects-persistence).
- **Offline export** — `editor.exportAudio()` renders the session (clips, mix, all effect chains) to an `AudioBuffer`. See [Offline Export](#offline-export).
- **Transport access** — Tempo, metronome, count-in, meter, effects via `@dawcore/transport`
- **CSS theming** — Dark mode by default, fully customizable via CSS custom properties
- **Native Web Audio** — Uses `@dawcore/transport` for playback scheduling. No Tone.js dependency.

## Installation

```bash
npm install @dawcore/components
```

Required peer dependencies:

```bash
npm install @waveform-playlist/core @waveform-playlist/engine
```

Audio backend (choose one — see [Choosing an Audio Backend](#choosing-an-audio-backend)):

```bash
npm install @dawcore/transport          # Native Web Audio (recommended)
# or
npm install @waveform-playlist/playout tone  # Tone.js
```

Optional peer dependencies — each is dynamic-imported on first use, so you only install (and ship) what you use:

```bash
npm install @waveform-playlist/worklets  # recording
npm install @dawcore/midi                # editor.loadMidi()
npm install @dawcore/wam                 # WAM 2.0 plugins (addWamPlugin) + generic effect GUIs
npm install @dawcore/faust @dawcore/wam  # in-browser Faust compilation (addFaustEffect)
```

## Quick Start

```html
<script type="module">
  import '@dawcore/components';
  import { NativePlayoutAdapter } from '@dawcore/transport';

  const editor = document.querySelector('daw-editor');
  const adapter = new NativePlayoutAdapter(new AudioContext());
  editor.adapter = adapter;
</script>

<daw-editor id="editor" samples-per-pixel="1024" wave-height="100" timescale>
  <daw-track src="/audio/drums.opus" name="Drums"></daw-track>
  <daw-track src="/audio/bass.opus" name="Bass"></daw-track>
  <daw-track src="/audio/synth.opus" name="Synth"></daw-track>
</daw-editor>

<daw-transport for="editor">
  <daw-play-button></daw-play-button>
  <daw-pause-button></daw-pause-button>
  <daw-stop-button></daw-stop-button>
</daw-transport>
```

The editor loads audio, generates waveforms, and handles playback.

## Choosing an Audio Backend

### Native Web Audio (recommended for most use cases)

No Tone.js dependency. Supports multi-tempo, multi-meter, metronome, count-in, and effects hooks.

```bash
npm install @dawcore/transport
```

```javascript
import { NativePlayoutAdapter } from '@dawcore/transport';

const ctx = new AudioContext({ sampleRate: 48000 });
const adapter = new NativePlayoutAdapter(ctx);
editor.adapter = adapter;

// Transport-specific features via adapter reference
adapter.transport.setMetronomeEnabled(true);
adapter.transport.setCountIn(true);
```

### Tone.js (effects, MIDI synths)

Uses Tone.js for audio processing. Single tempo/meter only. **Required for MIDI playback** — the native adapter has no MIDI synth, so MIDI clips render as piano-roll but play silently on it.

```bash
npm install @waveform-playlist/playout tone
```

```javascript
import { createToneAdapter } from '@waveform-playlist/playout';

const adapter = createToneAdapter();
editor.adapter = adapter;
```

## Multi-Clip Timeline

For multiple clips per track with independent positioning:

```html
<daw-editor id="editor" samples-per-pixel="1024" wave-height="80"
            timescale clip-headers interactive-clips>
  <daw-keyboard-shortcuts playback splitting undo></daw-keyboard-shortcuts>

  <daw-track name="Drums">
    <daw-clip src="/audio/drums.opus" start="0" duration="8"></daw-clip>
    <daw-clip src="/audio/drums.opus" start="12" duration="8" offset="8"></daw-clip>
  </daw-track>

  <daw-track name="Bass">
    <daw-clip src="/audio/bass.opus" start="0" duration="20"></daw-clip>
  </daw-track>
</daw-editor>
```

## MIDI Tracks

Programmatic MIDI clips render as piano-roll. Playback requires the Tone.js adapter (the native adapter has no MIDI synth). Use the `editor.addTrack({ midi })` sugar for the simplest path:

```javascript
import { createToneAdapter } from '@waveform-playlist/playout';

const editor = document.querySelector('daw-editor');
editor.adapter = createToneAdapter({ ppqn: 960 });

await editor.addTrack({
  name: 'Lead',
  midi: {
    notes: [
      { midi: 60, name: 'C4', time: 0.0, duration: 0.5, velocity: 0.8 },
      { midi: 64, name: 'E4', time: 0.5, duration: 0.5, velocity: 0.7 },
      { midi: 67, name: 'G4', time: 1.0, duration: 0.5, velocity: 0.8 },
    ],
    channel: 0,        // optional — 9 = GM percussion
    program: 24,       // optional — GM instrument 0-127 (used by SoundFontToneTrack)
  },
});
```

This expands to a `<daw-track render-mode="piano-roll">` containing a `<daw-clip>` whose `midiNotes` JS property is set to the notes array. Equivalent declarative form:

```html
<daw-track render-mode="piano-roll" name="Lead">
  <daw-clip midi-channel="0" midi-program="24"></daw-clip>
</daw-track>
<script>
  document.querySelector('daw-clip').midiNotes = [
    { midi: 60, name: 'C4', time: 0.0, duration: 0.5, velocity: 0.8 },
    // ...
  ];
</script>
```

A clip is treated as MIDI iff `clip.midiNotes != null`. MIDI clips skip audio fetch + decode + peak generation. Move drag works on MIDI clips; trim handles and split-at-playhead are inert on them.

**Theming:** the piano-roll honors `--daw-piano-roll-note-color` (default `#2a7070`), `--daw-piano-roll-selected-note-color` (default `#3d9e9e`), and `--daw-piano-roll-background` (default `#1a1a2e`).

See `examples/dawcore-tone/midi.html` for a runnable demo (C major scale, PolySynth playback). For SoundFont sample playback, pass `createToneAdapter({ soundFontCache })` and see `examples/dawcore-tone/soundfont.html`.

## Pre-Computed Peaks

For instant waveform rendering before audio finishes decoding:

```html
<daw-track name="Drums">
  <daw-clip src="/audio/drums.opus"
            peaks-src="/audio/drums.dat"
            start="0" duration="8"></daw-clip>
</daw-track>
```

The `.dat` file renders the waveform immediately. Audio decodes in the background for playback.

## Effects Persistence

`getEffectsState()` / `setEffectsState(entries)` on `<daw-editor>` (master chain) and `<daw-track>` snapshot and restore effect chains. Persist the returned array however you like (localStorage, server, project file):

```js
const saved = await editor.getEffectsState();
// [
//   { kind: 'native', type: 'native-delay', params: {...}, bypassed: false },
//   { kind: 'wam', url: 'https://…/index.js', bypassed: false, state: {…} },
// ]
localStorage.setItem('master-fx', JSON.stringify(saved));

// later / next session
await editor.setEffectsState(JSON.parse(localStorage.getItem('master-fx')));
```

WAM entries carry the plugin's own `getState()` snapshot, reapplied on restore. Faust entries (added with `addFaustEffect`) persist their DSP source instead of a URL — `{ kind: 'wam', faustDsp, faustName, bypassed, state }` — and are recompiled in the browser on restore. If a saved plugin URL is unreachable (or a saved Faust source no longer compiles), the restore **continues**: the entry becomes a bypassed passthrough placeholder at its saved position (a `daw-effect-error` event fires with `{effectId, url?, source?, message}`), and its saved state is retained so re-serializing round-trips it for a later retry.

## Transport Access

Transport-specific APIs are on the `NativePlayoutAdapter` reference:

```javascript
// Transport-specific APIs are on the NativePlayoutAdapter
adapter.transport.setTempo(140);
adapter.transport.setMeter(3, 4);
adapter.transport.setMetronomeEnabled(true);
adapter.transport.setCountIn(true);
adapter.transport.setCountInBars(1);
adapter.transport.setCountInMode('always');
adapter.transport.on('countIn', ({ beat, totalBeats }) => {
  console.log('Count-in: ' + beat + '/' + totalBeats);
});
adapter.transport.connectTrackOutput('track-id', reverbNode);
```

## Effects

Per-track and master effect chains (requires `@dawcore/transport` >= 0.0.13). `<daw-track>` owns its track chain; `<daw-editor>` owns the master chain — same API on both:

```javascript
const track = document.querySelector('daw-track');

// Built-in native-* effects: native-gain, native-filter, native-compressor,
// native-stereo-panner, native-delay
const filterId = track.addEffect('native-filter', { frequency: 800 });
const compressorId = editor.addEffect('native-compressor'); // master chain

track.setEffectParams(filterId, { frequency: 2000 });  // live, during playback
track.setEffectBypassed(filterId, true);
track.moveEffect(filterId, 1);
track.removeEffect(filterId);
console.log(track.effects);  // [{ id, kind, type, params, bypassed }, ...]
```

Effect events dispatch from the owning element and bubble to the editor:

```javascript
editor.addEventListener('daw-effect-add', (e) => console.log(e.detail));
// also: daw-effect-remove, daw-effect-change, daw-effect-bypass, daw-effect-reorder
```

Register custom effects with `registerEffect(type, definition)`; inspect built-ins with `getEffectDefinitions()` (exports from `@dawcore/components`).

### WAM Plugins

[Web Audio Modules 2.0](https://www.webaudiomodules.com/) plugins load into the same chains via the optional `@dawcore/wam` peer (`npm install @dawcore/wam`):

```javascript
const wamId = await track.addWamPlugin('https://www.webaudiomodules.com/community/plugins/burns-audio/delay/index.js');
// WAM entries are ordinary chain entries — bypass/move/remove/events all work
```

See `examples/dawcore-native/effects.html` for a native-effects demo and `examples/dawcore-wam/` (`pnpm example:dawcore-wam`) for the end-to-end WAM demo: URL paste, community-library picker (`fetchWamLibrary`), GUIs, persistence with reload, and WAV export.

### Faust Effects (compiled in the browser)

Write custom DSP in [Faust](https://faust.grame.fr/) and hear it instantly — `addFaustEffect(dspCode, options?)` compiles the source **in the browser** via the optional `@dawcore/faust` peer (`npm install @dawcore/faust @dawcore/wam`) and adds the result to the chain as an ordinary WAM entry:

```javascript
// Track chains are stereo — duplicate mono filters across both channels.
const effectId = await track.addFaustEffect(
  `import("stdfaust.lib");
   cutoff = hslider("cutoff", 1000, 20, 20000, 1);
   process = fi.lowpass(2, cutoff), fi.lowpass(2, cutoff);`,
  { name: 'My Lowpass' }
);
// Every hslider/vslider/checkbox becomes a WAM parameter + a GUI control.
```

The Faust compiler (~2.5 MB gzipped WASM) loads lazily on the first call — consumers who never compile Faust load zero compiler bytes. Compile errors keep Faust's line/column diagnostics and leave the chain untouched. Faust entries persist as their DSP source (`{ kind: 'wam', faustDsp, faustName, state }` — no URL) and are **recompiled** on `setEffectsState` restore and offline export. See the "Faust (compile in browser)" section of `examples/dawcore-wam/`.

### Effect GUIs

`openEffectGui(effectId, container)` / `closeEffectGui(effectId)` on both elements mount an effect's GUI into a container **you** provide (your own panel, drawer, floating window — dawcore ships no plugin-window UI):

```javascript
const panel = document.querySelector('#fx-panel');

const guiEl = await track.openEffectGui(wamId, panel); // WAM plugins mount their own GUI
track.closeEffectGui(wamId); // hides — audio keeps processing, element stays cached
await track.openEffectGui(wamId, panel); // instant reopen, same element
```

The GUI is created lazily on first open and only destroyed (`destroyGui`) when the effect — or its track — is removed from the chain. Plugins without a GUI, and `native-*` effects, get a generic parameter panel (labeled sliders from the plugin's `getParameterInfo()` or the registry's params metadata) rendered by `@dawcore/wam`; slider edits apply live and dispatch `daw-effect-change` like any other parameter edit.

### Offline Export

`editor.exportAudio(options?)` renders the whole session — clips, volume/pan, mute/solo, per-track and master effect chains — on an `OfflineAudioContext` and resolves to an `AudioBuffer` (encode it to WAV/FLAC however you like):

```javascript
const buffer = await editor.exportAudio();
// options: { sampleRate?, startTime?, duration?, channels? }
const intro = await editor.exportAudio({ startTime: 0, duration: 8, channels: 2 });
```

Chains rebuild from their persisted form: `native-*` effects via the registry, WAM plugins re-instantiated on the offline context with their saved state (worklets are bound to one context), and Faust entries recompiled from their persisted DSP source. Bypass behavior matches live playback; all offline plugin instances are destroyed after rendering.

## Programmatic File Loading

```javascript
const editor = document.getElementById('editor');
const result = await editor.loadFiles(fileList);
// result: { loaded: string[], failed: Array<{ file, error }> }
```

## Recording

```html
<daw-editor id="editor" samples-per-pixel="1024" wave-height="100">
  <daw-track name="Recording"></daw-track>
</daw-editor>

<daw-transport for="editor">
  <daw-play-button></daw-play-button>
  <daw-pause-button></daw-pause-button>
  <daw-stop-button></daw-stop-button>
  <daw-record-button></daw-record-button>
</daw-transport>

<script type="module">
  const editor = document.getElementById('editor');
  // Consumer provides the mic stream
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: { ideal: 2 } }  // request stereo when available
  });
  editor.recordingStream = stream;

  // Cancelable — prevent default to handle the AudioBuffer yourself
  editor.addEventListener('daw-recording-complete', (e) => {
    // e.preventDefault(); // skip automatic clip creation
    console.log('recorded:', e.detail.audioBuffer);
  });
</script>
```

## Keyboard Shortcuts

Add `<daw-keyboard-shortcuts>` as a child of `<daw-editor>`:

```html
<daw-editor id="editor">
  <daw-keyboard-shortcuts playback splitting undo></daw-keyboard-shortcuts>
  <!-- ... tracks ... -->
</daw-editor>
```

| Attribute | Shortcuts |
|-----------|-----------|
| `playback` | Space (play/pause), Enter (stop) |
| `splitting` | S (split at playhead) |
| `undo` | Cmd/Ctrl+Z (undo), Cmd/Ctrl+Shift+Z (redo) |

Custom shortcuts via JS properties: `playbackShortcuts`, `splittingShortcuts`, `undoShortcuts`, `customShortcuts`.

## CSS Theming

Style with CSS custom properties on `<daw-editor>` or any ancestor:

```css
daw-editor {
  --daw-wave-color: #c49a6c;
  --daw-playhead-color: #d08070;
  --daw-background: #1a1a2e;
  --daw-track-background: #16213e;
  --daw-ruler-color: #c49a6c;
  --daw-ruler-background: #0f0f1a;
  --daw-selection-color: rgba(99, 199, 95, 0.3);
  --daw-controls-background: #1a1a2e;
  --daw-controls-text: #e0d4c8;
  --daw-clip-header-background: rgba(0, 0, 0, 0.4);
  --daw-clip-header-text: #e0d4c8;
  --daw-controls-width: 180px;
  --daw-min-height: 200px;
  --daw-piano-roll-note-color: #2a7070;
  --daw-piano-roll-selected-note-color: #3d9e9e;
  --daw-piano-roll-background: #1a1a2e;
}
```

## Elements

### `<daw-editor>`

Core orchestrator. Attributes:

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `samples-per-pixel` | number | `1024` | Zoom level (clamped to the pre-computed peaks floor when one is active) |
| `wave-height` | number | `128` | Track waveform height in pixels |
| `timescale` | boolean | `false` | Show time ruler |
| `clip-headers` | boolean | `false` | Show clip name headers |
| `clip-header-height` | number | `20` | Clip header height in pixels |
| `interactive-clips` | boolean | `false` | Enable drag/trim/split |
| `file-drop` | boolean | `false` | Accept audio files dropped onto the editor |
| `mono` | boolean | `false` | Merge stereo to mono display |
| `bar-width` / `bar-gap` | number | `1` / `0` | Waveform bar rendering style |
| `indefinite-playback` | boolean | `false` | Keep ruler/timeline filling the viewport with no clips |
| `scale-mode` | string | `'temporal'` | `'temporal'` (seconds) or `'beats'` (tick-linear grid) |
| `ticks-per-pixel` | number | `24` | Zoom level in beats mode |
| `snap-to` | string | `'off'` | Grid snapping in beats mode (`'bar'`, `'beat'`, `'1/2'`…`'1/16'`, `'off'`) |
| `eager-resume` | string | — | Resume AudioContext on first gesture; bare attribute targets the editor, or pass `"document"` / a CSS selector |

JS properties: `adapter` (required `PlayoutAdapter`), `recordingStream`, `bpm`, `ppqn`, `timeSignature`, `meterEntries`, `secondsToTicks` / `ticksToSeconds` (variable-tempo callbacks), `spectrogramConfig`, `spectrogramColorMap`. Read-only: `engine`, `audioContext` (from the adapter), `tracks`, `selection`, `selectedTrackId`, `currentTime`, `canUndo` / `canRedo`, `isRecording`.

Methods:

- Playback: `play(startTime?)`, `pause()`, `stop()`, `togglePlayPause()`, `seekTo(time)`
- Loading: `loadFiles(files)`, `loadMidi(urlOrFile, options?)`, `ready()`
- Tracks & clips: `addTrack(config)`, `removeTrack(id)`, `updateTrack(id, partial)`, `addClip(trackId, config)`, `removeClip(trackId, clipId)`, `updateClip(trackId, clipId, partial)`
- Editing: `splitAtPlayhead()`, `undo()`, `redo()`, `setSelection(start, end)`
- Recording: `startRecording(stream?, options?)`, `stopRecording()`, `pauseRecording()`, `resumeRecording()`, `togglePauseRecording()`
- Effects & export: the master-chain effects API (see [Effects](#effects)), `getEffectsState()` / `setEffectsState(entries)`, `openEffectGui()` / `closeEffectGui()`, `exportAudio(options?)`

### `<daw-track>`

Declarative track data. Attributes: `src`, `name`, `volume`, `pan`, `muted`, `soloed`, `render-mode` (`'waveform' | 'piano-roll' | 'spectrogram'`, default `'waveform'`). JS property: `spectrogramConfig` (per-track spectrogram override). Also exposes the per-track effects API (see [Effects](#effects)).

### `<daw-clip>`

Declarative clip data. Attributes: `src`, `peaks-src`, `start`, `duration`, `offset`, `gain`, `name`, `color`, `midi-channel`, `midi-program`. JS-only property: `midiNotes: MidiNoteData[] | null` (note arrays are too large for attributes).

### `<daw-piano-roll>`

Visual element for MIDI note rendering. Mounted automatically when the parent track has `render-mode="piano-roll"` — you don't usually instantiate it directly. See [MIDI Tracks](#midi-tracks).

### `<daw-transport for="editor-id">`

Container that resolves target editor. Children: `<daw-play-button>`, `<daw-pause-button>`, `<daw-stop-button>`, `<daw-record-button>`.

### `<daw-track-controls>`

Per-track UI for volume, pan, mute, solo. Receives state from editor, dispatches `daw-track-control` and `daw-track-remove` events.

### `<daw-keyboard-shortcuts>`

Render-less child of `<daw-editor>`. Boolean attributes: `playback`, `splitting`, `undo`.

## Events

```javascript
const editor = document.getElementById('editor');

// Playback
editor.addEventListener('daw-play', () => {});
editor.addEventListener('daw-pause', () => {});
editor.addEventListener('daw-stop', () => {});
editor.addEventListener('daw-seek', (e) => console.log(e.detail.time));

// Selection & tracks
editor.addEventListener('daw-selection', (e) => console.log(e.detail));
editor.addEventListener('daw-track-select', (e) => console.log(e.detail.trackId));

// Clip interactions
editor.addEventListener('daw-clip-move', (e) => console.log(e.detail));
editor.addEventListener('daw-clip-trim', (e) => console.log(e.detail));
editor.addEventListener('daw-clip-split', (e) => console.log(e.detail));

// Recording
editor.addEventListener('daw-recording-start', (e) => console.log(e.detail));
editor.addEventListener('daw-recording-complete', (e) => {
  // e.preventDefault() to skip automatic clip creation
  console.log(e.detail.audioBuffer);
});

// Effects (track events bubble up to the editor)
editor.addEventListener('daw-effect-add', (e) => console.log(e.detail));
editor.addEventListener('daw-effect-change', (e) => console.log(e.detail));
// also: daw-effect-remove, daw-effect-bypass, daw-effect-reorder

// Errors
editor.addEventListener('daw-track-error', (e) => console.error(e.detail));
editor.addEventListener('daw-error', (e) => console.error(e.detail));
editor.addEventListener('daw-files-load-error', (e) => console.error(e.detail));
editor.addEventListener('daw-effect-error', (e) => console.error(e.detail));
```

All events and their `detail` payloads are typed in the exported `DawEventMap`.

## Custom AudioContext

Pass a custom `AudioContext` via the adapter:

```javascript
const ctx = new AudioContext({ sampleRate: 48000, latencyHint: 0 });
const adapter = new NativePlayoutAdapter(ctx);
editor.adapter = adapter;
```

Set the adapter before tracks load. The provided context is used for decoding, playback, and recording.

## Examples & Documentation

- [`examples/dawcore-native/`](https://github.com/naomiaro/waveform-playlist/tree/main/examples/dawcore-native) — native transport: basics, multi-clip, metronome, beats grid, beat maps, effects, spectrogram, recording (`pnpm example:dawcore-native`)
- [`examples/dawcore-tone/`](https://github.com/naomiaro/waveform-playlist/tree/main/examples/dawcore-tone) — Tone.js adapter: MIDI, SoundFont playback (`pnpm example:dawcore-tone`)
- [`examples/dawcore-wam/`](https://github.com/naomiaro/waveform-playlist/tree/main/examples/dawcore-wam) — WAM plugins end-to-end + in-browser Faust compilation (`pnpm example:dawcore-wam`)
- Guides: [naomiaro.github.io/waveform-playlist](https://naomiaro.github.io/waveform-playlist/docs/web-components/getting-started)

## License

MIT
