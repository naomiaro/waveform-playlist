# Multi-Channel VU Meter Design

**Date:** 2026-03-09
**Branch:** `feat/multi-channel-vu-meter`
**Issue:** [#241](https://github.com/naomiaro/waveform-playlist/issues/241)
**Semver:** Minor (new features, no breaking changes)

## Problem

The existing VU meter is single-channel and visually basic (horizontal bar). Users need:
1. Multi-channel (L/R stereo) level monitoring for recording input
2. Output level metering during playback
3. A professional-looking meter component (LED-segment style, like DAW mixers)
4. Documentation on how to build custom VU meter visualizations using the hooks API

## Design Decisions

### Metering Engine: Tone.js Meter (AnalyserNode)

Stick with Tone.js `Meter` which wraps native `AnalyserNode`. It already supports multi-channel via `channelCount` option — when `channels > 1`, `getValue()` returns `number[]`.

**Why not AudioWorklet:** AudioWorklet metering (like openDAW's `MeterProcessor`) is more accurate but requires `SharedArrayBuffer` + COOP/COEP headers, adding deployment friction. Tone.js Meter is sufficient for visual VU meters.

### Separate Output Meter Hook (not generalized)

New `useOutputMeter` in browser package rather than generalizing `useMicrophoneLevel`. Keeps recording and playback concerns in their respective packages. The duplication is ~15-20 lines of Meter + rAF logic — worth it for clean package boundaries.

### Visual Component in ui-components

`SegmentedVUMeter` is a pure visual component (takes `levels: number[]`, renders segments). No audio dependencies. Lives in `ui-components` alongside theme tokens and other visual components.

### Shared dB Utilities in core

Extract `dBToNormalized` and `normalizedToDb` into `@waveform-playlist/core` to avoid duplicating the dB-to-0-1 conversion across recording and browser packages.

## Changes

### 1. Core Package — dB Conversion Utilities

New file: `packages/core/src/audio/dBUtils.ts`

```typescript
/** Convert dB value to normalized 0-1 range. */
export function dBToNormalized(dB: number, floor?: number): number;

/** Convert normalized 0-1 value back to dB. */
export function normalizedToDb(normalized: number, floor?: number): number;
```

Default floor: `-100` (Firefox reports lower dB values than Chrome for quiet input).

### 2. Recording Package — Upgrade `useMicrophoneLevel`

Add `channelCount` option. Return new per-channel arrays alongside existing single values.

```typescript
interface UseMicrophoneLevelOptions {
  // ... existing options ...
  channelCount?: number; // default: 1
}

interface UseMicrophoneLevelReturn {
  // Backwards-compatible (channel 0 for single, max across channels for multi)
  level: number;
  peakLevel: number;
  resetPeak: () => void;
  // New: per-channel arrays
  levels: number[];
  peakLevels: number[];
}
```

Tone.js `Meter` created with `channelCount` option. When `channelCount > 1`, `getValue()` returns `number[]`. The hook normalizes each channel value using `dBToNormalized` from core.

`useIntegratedRecording` passes through the new fields.

### 3. Browser Package — New `useOutputMeter`

New file: `packages/browser/src/hooks/useOutputMeter.ts`

```typescript
interface UseOutputMeterOptions {
  channelCount?: number;             // default: 2 (stereo output)
  smoothingTimeConstant?: number;    // default: 0.8
  updateRate?: number;               // default: 60
}

interface UseOutputMeterReturn {
  levels: number[];
  peakLevels: number[];
  resetPeak: () => void;
}
```

Connects a `Meter` to `Tone.getDestination()`. Polls via `requestAnimationFrame`. Same dB normalization as `useMicrophoneLevel`. Consumers control lifecycle by mounting/unmounting.

### 4. UI Components Package — `SegmentedVUMeter`

New file: `packages/ui-components/src/components/SegmentedVUMeter.tsx`

```typescript
interface SegmentedVUMeterProps {
  levels: number[];                              // per-channel, 0-1
  peakLevels?: number[];                         // optional peak hold
  channelLabels?: string[];                      // e.g., ['L', 'R']
  orientation?: 'vertical' | 'horizontal';       // default: 'vertical'
  segmentCount?: number;                         // default: 24
  dBRange?: [number, number];                    // default: [-50, 5]
  showScale?: boolean;                           // default: true
  colorStops?: Array<{ dB: number; color: string }>;
  segmentWidth?: number;                         // default: 20
  segmentHeight?: number;                        // default: 8
  segmentGap?: number;                           // default: 2
  className?: string;
}
```

**Rendering:** Styled-components with `.attrs()` for per-segment active/inactive state. Each segment maps to a dB threshold. A segment is "lit" if the channel's level exceeds that threshold.

**Default color stops** (matching issue #241 image):

| dB Range | Color |
|----------|-------|
| +2 to +5 | Red `#e74c3c` |
| -2 to +2 | Orange/Yellow `#f39c12` / `#f1c40f` |
| -8 to -2 | Green `#2ecc71` |
| -50 to -8 | Blue `#5dade2` / `#85c1e9` |

**Peak hold:** White/bright segment at peak position.

### 5. Website — Recording Example Update

Replace the horizontal `VUMeter` with two `SegmentedVUMeter` instances:
- **Input meter** — fed by `useMicrophoneLevel` with `channelCount: 2`. Visible when mic permission is granted.
- **Output meter** — fed by `useOutputMeter`. Always visible.

Layout: side-by-side labeled "Input" and "Output" within the recording controls card.

### 6. Website — New Guide Doc

New file: `website/docs/guides/vu-meters.md`

Sections:
1. Built-in meters (`VUMeter`, `SegmentedVUMeter`)
2. Data hooks (`useMicrophoneLevel`, `useOutputMeter`)
3. Building a custom meter from hooks (the core answer to issue #241)
4. Multi-channel configuration

### 7. Website — Update Existing Docs

- `recording.md`: Update "Level Monitoring" section with `levels[]`/`peakLevels[]` API, link to new guide
- `hooks.md`: Add `useOutputMeter` and updated `useMicrophoneLevel` interfaces
- `llm-reference.md`: Add new interfaces
- `llms.txt`: Mention VU meter capabilities

## Testing

| Area | Package | What |
|------|---------|------|
| `dBToNormalized` / `normalizedToDb` | core | Boundary values, Firefox low values, clipping, custom floor |
| `SegmentedVUMeter` | ui-components | Segment count, lit segments, peak indicators, labels, colors, orientation |
| `useMicrophoneLevel` multi-channel | recording | Mock Meter → `number[]`, verify `levels`/`peakLevels`, backwards compat |
| `useOutputMeter` | browser | Mock Destination + Meter, lifecycle, level polling |
| Storybook stories | ui-components | Default, horizontal, single channel, stereo, custom colors, animated |
| E2E | website | Verify segment structure renders in recording example |

## Not In Scope

- AudioWorklet-based metering (future enhancement)
- Per-track meters (needs engine-level support)
- Spectrum/FFT visualization (exists via `useMasterAnalyser`)
