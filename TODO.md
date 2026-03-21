# TODO & Roadmap

Multi-track audio editor roadmap for waveform-playlist.

**Branch:** `main` | **Last Updated:** 2026-03-10

---

### Testing & CI

- [ ] **CD pipeline** — Automated npm publishing (currently manual via `pnpm publish`)

### Playback UX

- [ ] **Eager AudioContext resume** — Resume AudioContext on first user interaction (click/keydown) within playlist, before play is pressed. Eliminates ~200-500ms delay on first space bar press. Use `resumeGlobalAudioContext()` (raw context resume), NOT `Tone.start()` which adds ~2s latency on Safari if called redundantly.
- [ ] **Undo/redo** — Command pattern for reversible operations (clip move, trim, split, delete, volume/pan changes). Expose via `useUndoRedo()` hook with `undo()`, `redo()`, and `canUndo`/`canRedo` state. Consider [`undo-manager`](https://www.npmjs.com/package/undo-manager) as a lightweight foundation.
- [ ] **Keyboard shortcuts help overlay** — Modal or panel showing all available keyboard shortcuts, triggered by `?` key.
- [ ] **Accessibility** — ARIA roles and labels for tracks, clips, and transport controls. Focus management for keyboard navigation between tracks and clips.
- [ ] **Context menus** — Right-click menus on tracks (mute, solo, remove, duplicate) and clips (split, trim, delete, copy).

### Editing

- [ ] **Clipboard operations** — Cut (Cmd+X), copy (Cmd+C), and paste (Cmd+V) for clips. Paste inserts at the current cursor position on the selected track.
- [ ] **Multi-select** — Select multiple clips with Cmd+Click (toggle individual) and Shift+Click (range). Visual indicator for selected clips.
- [ ] **Bulk operations** — Drag, delete, and apply effects to multiple selected clips at once. Selection toolbar with common actions.

### VU Meter Improvements

- [ ] **IEC-60268 piecewise linear scale** — The current `SegmentedVUMeter` maps dB to segments linearly, giving the same pixel space to -50 dB through -25 dB as to -6 dB through 0 dB. In practice, the quiet end of the meter is where you need the most detail (setting recording levels, checking noise floor). IEC-60268 defines a piecewise linear scale that gives more room to quiet signals:
  - 50% of the meter width for the quietest 1/3 of the dB range
  - 20% for the next 1/6
  - 15% for the next 1/6
  - 15% for the remainder
  - This makes low-level signals ~3x more readable without changing the dB range. Useful when setting mic gain or monitoring quiet ambient recordings.
  - Add as a `scale` prop: `'linear'` (current default) | `'iec-60268'`. The scale function converts a dB value to a 0–1 position on the meter.

- [ ] **Recent peak indicator** — A second peak marker showing the highest level in a configurable rolling window, distinct from the existing max-ever held peak. The held peak tells you "the loudest it's ever been since reset" — useful for clipping checks. The recent peak tells you "the loudest it was in the last half second" — useful for monitoring dynamics while recording or mixing.
  - Add `recentPeakWindow` prop (milliseconds, default 600). Set to `0` to disable.
  - Store level readings in a circular buffer. On each render, discard entries older than the window and take the max of what remains.
  - Render as a thin marker line in a distinct color from the held peak marker.
  - Example: during a vocal recording, the held peak stays at -2 dB from a loud phrase 30 seconds ago, while the recent peak bounces around -12 dB showing current performance dynamics.

- [ ] **Clickable clipping indicator** — A dedicated element (e.g. small square or dot) at the top/right end of the meter that turns red when any channel hits 0 dB. Clicking it resets the clipping state. Currently clipping is only visible through segment color — there's no persistent, reset-able indicator. Standard in pro audio hardware and software — lets you see at a glance whether clipping occurred at any point during a take, then reset before the next take.
  - Add `showClipIndicator` prop (boolean, default `false`).
  - Add `onClipReset` callback prop.
  - Clipping triggers when level >= `dBRange[1]` (the max end of the scale).

- [ ] **RMS+Peak dual display mode** — Show both RMS and peak simultaneously on the same meter bar. Peak shows instantaneous loudest samples (important for clipping). RMS shows average signal power over time (closer to perceived loudness). Seeing both together helps with mixing decisions — a large gap between peak and RMS means dynamic audio, a small gap means heavily compressed.
  - Add `displayMode` prop: `'peak'` (current default) | `'rms'` | `'peak+rms'`.
  - In `'peak+rms'` mode, the component expects both `levels` (peak) and `rmsLevels` props. RMS bar uses the primary color, peak overlay uses the same color at ~30% opacity.
  - Example: a snare drum shows RMS at -18 dB with peak spikes to -6 dB. A pad synth shows RMS at -12 dB with peaks at -10 dB.

- [ ] **Worklet ballistic filters with configurable decay** — Move metering ballistics into the `meter-processor` AudioWorklet where every sample is already available. This guarantees sample-accurate behavior regardless of UI frame rate — the worklet processes at the audio rate (e.g. 48kHz) while the UI renders at 60fps.
  - Add a `ballistics` option to `useMicrophoneLevel` and `useOutputMeter`: `'peak'` (default) | `'vu'` | `'ppm'`. Sets the worklet's filter mode via `postMessage`.
  - **Peak mode** (current): Raw peak + RMS per buffer, no filtering. Attack is instantaneous. Best for recording level checks and clipping detection.
  - **VU mode**: Two-stage cascade filter with attack coefficient `w = 11.1 / sampleRate` and gain `g ≈ 2.357`. Produces the smooth, weighted rise/fall of an analog needle. Better for gauging perceived loudness during mixing — the meter's inertia naturally averages out transients.
  - **PPM mode**: Asymmetric attack/release — fast attack (~5ms integration), slow release (~1.7s to -24dB). Three filter coefficients: `w1`, `w2` (attack), `w3` (release). Catches transients more aggressively than VU while still smoothing the display. Used in broadcast for ensuring peaks don't exceed transmission limits.
  - The worklet also handles **decay and hold**: configurable via `decayRate` (dB/s, default 36) and `holdTime` (ms, default 0). Hold keeps the level at peak for the specified duration before decay begins. Decay formula per frame: `level = max(newLevel, previousLevel - decayRate * deltaTime)`.
  - The worklet posts the filtered level values; the UI renders them directly without additional smoothing.

- [ ] **LED stripe overlay** — Optional visual effect that draws thin horizontal lines across the meter at regular intervals, simulating the look of physical LED segment meters found on mixing consoles and outboard gear.
  - Add `ledStripe` prop (boolean, default `false`).
  - Render as semi-transparent dark lines (e.g. 1px at 40% opacity) at 2–3px intervals over the filled bar area.
  - Purely cosmetic — does not affect segment count or dB mapping. Works with any `displayMode` or `scale`.

- [ ] **K-system color zones and dB range presets** — Target-relative color coding for loudness-aware metering, plus named presets for the existing `dBRange` prop.
  - **K-system colors**: Three zones relative to a configurable target level. Green: below target (normal operating range). Yellow: target to target+2 dB (approaching loud). Red: above target+2 dB (too loud). Unlike the standard green→yellow→red gradient which is fixed to absolute dB values, K-system zones shift with the target — a K-20 meter (cinema/classical) has more green headroom than a K-12 meter (broadcast).
  - Add `colorMode` prop: `'standard'` (current gradient) | `'k-system'`.
  - Add `kTarget` prop (dB, default -20 for K-20). Common values: -20 (cinema/classical), -14 (pop/rock), -12 (broadcast).
  - K-system meters typically pair with RMS levels, so `colorMode='k-system'` should default `displayMode` to `'peak+rms'` if not explicitly set.
  - **dB range presets**: Accept either `dBRange={[-60, 0]}` (tuple, current) or a named preset string. Presets: `'broadcast'` → [-60, 0], `'recording'` → [-50, 5], `'mastering'` → [-96, 0], `'speech'` → [-36, 0].

### Performance

- [ ] **Vertical virtual scrolling** — Only render tracks visible in the viewport when the project has 20+ tracks. Recycle DOM nodes as the user scrolls.
- [ ] **RAF batching** — Batch `requestAnimationFrame` updates to reduce layout thrashing during playback and scrubbing.
- [ ] **Re-render spectrograms on tab visibility** — OffscreenCanvas buffers can be cleared by the browser when a tab is backgrounded. Detect visibility change and re-render.
- [ ] **Bundle size monitoring** — Track bundle size in CI to catch regressions.
- [ ] **Performance benchmarks** — Automated benchmarks for waveform rendering, peak generation, and playback startup.
- [ ] **Memory leak testing** — Automated checks for leaked AudioNodes, detached canvases, and orphaned event listeners.

### Timeline

- [ ] **Tempo automation / tempo maps** — Support multiple BPMs across the timeline for projects with tempo changes.
  - Current v1: `BeatsAndBarsProvider` accepts a single global `bpm` and `timeSignature`. `<daw-tempo>` and `<daw-time-signature>` web components reflect/edit these values. PPQN-based integer math in the ruler and snap grid is correct and carries forward.
  - v2 (tempo map): Engine owns a `TempoMap` (sorted `TempoEvent[]` with sample position, BPM, time signature, curve type). Exposes `getBpmAt(sample)`, `sampleToMusicalTime(sample)`, `musicalTimeToSample(bar, beat, tick)`. Provider subscribes via `statechange`. `<daw-tempo>` / `<daw-time-signature>` show/edit the value at the current playhead position.
  - Key change: sample ↔ musical time conversion becomes non-linear (must integrate across tempo segments). Affects ruler tick spacing, snap grid, time format display, and Tone.js Transport automation (`bpm.setValueAtTime()`).
- [ ] **Time signature changes** — Allow time signature to change mid-timeline (e.g., 4/4 → 3/4 → 6/8). Folded into `TempoEvent` so tempo and time signature share the same position-indexed map.
- [ ] **Sub-beat snap granularities** — Snap to 1/8, 1/16, triplets, and other subdivisions when editing clips.
- [ ] **Metronome / click track** — Built-in click track that follows tempo and time signature settings. Use `Transport.scheduleRepeat` with musical time subdivisions — scheduling auto-follows BPM changes.
- [ ] **Musical time formats** — Add `bar:beat` and `bar:beat:tick` options to `<daw-time-format>` / `setTimeFormat()`. Requires tempo map and time signature data. Follows Audacity's approach where the time format selector offers both absolute (hh:mm:ss) and musical (bar:beat) formats.

### WAM Plugin Support

WAM 2.0 is an open plugin standard for the Web Audio API — the browser equivalent of VST/AU. Plugins are loaded at runtime, expose AudioNodes for graph insertion, and provide their own UIs. Supporting WAM opens the door to a growing ecosystem of third-party effects, instruments, and DSP tools without bundling them.

- [ ] **WAM host initialization** — Initialize the WAM host environment on the shared AudioContext so plugins can be instantiated. This is a one-time setup that creates a plugin group for event routing between plugins on the same context.
  - Call `initializeWamHost(audioContext)` once during playlist initialization (or lazily on first plugin load). Store the returned `hostGroupId` for plugin instantiation.
  - Expose via a `useWamHost()` hook that returns `{ hostGroupId, isReady }`. The hook should be idempotent — multiple consumers calling it shouldn't re-initialize.
  - Guard against AudioContext state — host init requires a running context, so defer until after first user gesture (same timing as `resumeGlobalAudioContext()`).
  - Example: a user opens the effects panel for the first time; the host initializes in the background before any plugin loads.

- [ ] **Per-track WAM plugin slot** — Allow each track to load a single WAM plugin inserted into its audio chain. The plugin's `audioNode` sits between the track's source and its gain/pan stage, processing audio in real time.
  - Add a `plugin` field to track state: `{ url: string; state?: any } | null`.
  - On load: dynamically import the plugin's `index.js`, call `PluginFactory.createInstance(hostGroupId, audioContext, savedState)`, and wire `source → plugin.audioNode → gainNode`.
  - On removal: call `plugin.audioNode.destroy()`, disconnect, and restore direct routing.
  - Handle hot-swap — replacing one plugin with another should cleanly tear down the old instance before connecting the new one, with no audio glitches (brief mute during swap is acceptable).
  - Example: a user applies a WAM reverb plugin to a vocal track, then swaps it for a delay — the old reverb is destroyed and the delay takes its place in the chain.

- [ ] **Plugin chain (multi-plugin per track)** — Extend the single-slot model to support an ordered chain of WAM plugins per track, similar to an effects rack. Audio flows through each plugin in sequence.
  - Track state becomes `plugins: Array<{ url: string; state?: any }>`.
  - Chain management: insert at position, remove, reorder (drag-and-drop in UI). Reconnect the audio graph on every topology change.
  - Use WAM event routing (`connectEvents`) between adjacent plugins so automation and MIDI flow through the chain.
  - Example: a guitar track with a tuner → compressor → amp sim → reverb chain, where the user can reorder or bypass individual plugins.

- [ ] **Plugin discovery and loading** — Provide a mechanism for users to discover and load WAM plugins from URLs or a curated registry. Plugins are ES modules loaded via dynamic `import()`.
  - Accept plugin URLs directly (paste a URL to a WAM `index.js`).
  - Support WAM library manifests (`library.json`) — a JSON file listing available plugins with metadata (name, description, thumbnail, URL). Parse and display as a browsable list.
  - Validate `WamDescriptor` after loading — check `apiVersion` compatibility, `hasAudioInput`/`hasAudioOutput` flags, and reject incompatible plugins with a clear error message.
  - Cache loaded plugin factories in a `Map<url, PluginFactory>` so re-instantiating the same plugin on another track doesn't re-fetch.
  - Example: a user pastes a URL to a community-built WAM compressor; the host fetches it, validates the descriptor, and makes it available in the plugin selector.

- [ ] **Plugin GUI embedding** — Mount WAM plugin GUIs in a panel or floating window. WAM plugins create their own DOM elements via `createGui()`, which can be appended to any container.
  - Call `await plugin.createGui()` to get an `HTMLElement`. Mount it in a designated panel (e.g., a drawer below the track, or a floating window).
  - GUIs use ShadowDOM for style isolation — no CSS conflicts with the playlist UI.
  - Show/hide GUI without destroying the plugin instance (toggling visibility, not mount/unmount).
  - Provide a fallback for plugins without a GUI — render a generic parameter list using `getParameterInfo()` with sliders for each parameter.
  - Example: a user clicks the plugin name on a track to open its GUI in a floating panel; closing the panel hides the GUI but the effect keeps processing audio.

- [ ] **Plugin state persistence** — Save and restore plugin state so projects can be reopened with the same plugin configurations. WAM plugins support `getState()` and `setState()` for serializable snapshots.
  - On project save: iterate all tracks, call `await plugin.getState()` for each loaded plugin, and include the state alongside the plugin URL in the project data.
  - On project load: after instantiating each plugin, call `await plugin.setState(savedState)` to restore parameters, presets, and internal state.
  - Handle missing plugins gracefully — if a saved plugin URL is unreachable, show a placeholder with the plugin name and skip it rather than failing the entire project load.
  - Example: a user saves a project with a reverb and delay on two tracks; reopening the project restores both plugins with their exact parameter settings.

- [ ] **WAM transport events** — Broadcast transport state (playhead position, tempo, time signature, playing/stopped) to all loaded WAM plugins via `wam-transport` events. This lets tempo-synced effects (delays, LFOs, arpeggiators) lock to the playlist's timeline.
  - On play/stop/seek: dispatch `wam-transport` events to all active plugin nodes with current `tempo`, `timeSigNumerator`, `timeSigDenominator`, `currentBar`, and `playing` state.
  - On tempo or time signature change: re-broadcast updated transport data.
  - Example: a tempo-synced delay plugin automatically adjusts its delay time when the user changes the project BPM from 120 to 140.

- [ ] **Faust DSP integration** — Support loading Faust DSP code as WAM plugins via `faust2wam`. Faust is a functional DSP language that compiles to WebAssembly — users can write custom effects in a few lines of code and hear them instantly.
  - **Static mode**: load pre-compiled Faust WAM plugins from URLs (same as any WAM plugin — no special handling needed beyond the plugin loader).
  - **Dynamic mode**: accept raw Faust DSP code (string), compile in the browser using `@shren/faust2wam`'s `generate()` function, and instantiate the resulting WAM class. This requires shipping the Faust compiler (~2MB WASM).
  - Provide a code editor UI (e.g., textarea with syntax highlighting) where users can write or paste Faust code, click "Compile", and apply the resulting effect to a track.
  - Auto-extract parameters from Faust's `hslider`/`vslider`/`checkbox` declarations — the compiled plugin's GUI renders controls automatically.
  - Example: a user writes `process = fi.lowpass(2, hslider("cutoff", 1000, 20, 20000, 1));` in the editor, compiles it, and applies a custom 2nd-order lowpass filter to a track with a cutoff knob.

### Project

- [ ] **Clip grouping** — Group multiple clips so they move, delete, and copy as a unit.
- [ ] **Automation lanes** — Per-track automation curves for volume, pan, and effect parameters over time.
- [ ] **Markers and regions** — Named time markers and regions for navigation and export.
- [ ] **MIDI/video sync** — Synchronize playback with external MIDI timecode or video players.
- [ ] **Sticky clip header text** — Keep track/clip name visible when scrolling horizontally using Intersection Observer.
- [ ] **Contributing guidelines** — Document contribution workflow, code standards, and PR process.
- [ ] **Revamp GitHub Sponsors tiers** — Update sponsorship tiers and perks via GitHub UI.
- [ ] **Web Components UI layer** — Build a vanilla TypeScript + native Web Components layer on top of `@waveform-playlist/engine` as the primary UI implementation. Custom elements (`<waveform-playlist>`, `<waveform-track>`, `<waveform-transport>`) with Shadow DOM, attribute/property configuration, and custom events. React 19+ has native Web Components interop, so React users could consume these directly — eliminating the need for a separate React-specific UI layer.

