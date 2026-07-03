# TODO & Roadmap

Multi-track audio editor roadmap for waveform-playlist.

**Branch:** `main` | **Last Updated:** 2026-07-03

---

### Testing & CI

- [ ] **CD pipeline** — Automated npm publishing (currently manual via `pnpm publish`)

### Playback UX

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

- [ ] **Sub-beat snap granularities** — Snap to 1/8, 1/16, triplets, and other subdivisions when editing clips.
- [ ] **Musical time formats** — Add `bar:beat` and `bar:beat:tick` options to `<daw-time-format>` / `setTimeFormat()` (today it offers only `hh:mm:ss.sss` / `hh:mm:ss` / `seconds`). Requires tempo map and time signature data. Follows Audacity's approach where the time format selector offers both absolute (hh:mm:ss) and musical (bar:beat) formats.

### Project

- [ ] **Clip grouping** — Group multiple clips so they move, delete, and copy as a unit.
- [ ] **Automation lanes** — Per-track automation curves for volume, pan, and effect parameters over time.
- [ ] **Markers and regions** — Named time markers and regions for navigation and export.
- [ ] **MIDI/video sync** — Synchronize playback with external MIDI timecode or video players.
- [ ] **Sticky clip header text** — Keep track/clip name visible when scrolling horizontally using Intersection Observer.
- [ ] **Contributing guidelines** — Document contribution workflow, code standards, and PR process.
- [ ] **Revamp GitHub Sponsors tiers** — Update sponsorship tiers and perks via GitHub UI.
