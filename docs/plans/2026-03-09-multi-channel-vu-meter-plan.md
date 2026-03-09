# Multi-Channel VU Meter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add multi-channel VU metering (input + output) with a professional LED-segment visual component and documentation for custom meters.

**Architecture:** Shared dB utilities in core, multi-channel `useMicrophoneLevel` upgrade in recording, new `useOutputMeter` in browser, pure visual `SegmentedVUMeter` in ui-components. Each layer has no audio coupling to the next.

**Tech Stack:** Tone.js Meter (AnalyserNode-based), React hooks, styled-components with `.attrs()`, Vitest

---

### Task 1: dB Conversion Utilities (core)

**Files:**
- Create: `packages/core/src/utils/dBUtils.ts`
- Modify: `packages/core/src/utils/index.ts`
- Create: `packages/core/src/__tests__/dBUtils.test.ts`

**Step 1: Write the failing tests**

```typescript
// packages/core/src/__tests__/dBUtils.test.ts
import { describe, it, expect } from 'vitest';
import { dBToNormalized, normalizedToDb } from '../utils/dBUtils';

describe('dBToNormalized', () => {
  it('maps 0 dB to 1.0', () => {
    expect(dBToNormalized(0)).toBe(1);
  });

  it('maps -100 dB (floor) to 0.0', () => {
    expect(dBToNormalized(-100)).toBe(0);
  });

  it('maps -50 dB to 0.5', () => {
    expect(dBToNormalized(-50)).toBe(0.5);
  });

  it('clamps below floor to 0', () => {
    expect(dBToNormalized(-120)).toBe(0);
  });

  it('clamps above 0 dB to 1', () => {
    expect(dBToNormalized(5)).toBe(1);
  });

  it('handles -Infinity as 0', () => {
    expect(dBToNormalized(-Infinity)).toBe(0);
  });

  it('handles Firefox low values (-85 dB)', () => {
    const result = dBToNormalized(-85);
    expect(result).toBeCloseTo(0.15, 2);
  });

  it('accepts custom floor', () => {
    expect(dBToNormalized(-60, -60)).toBe(0);
    expect(dBToNormalized(-30, -60)).toBe(0.5);
  });
});

describe('normalizedToDb', () => {
  it('maps 1.0 to 0 dB', () => {
    expect(normalizedToDb(1)).toBe(0);
  });

  it('maps 0.0 to floor dB', () => {
    expect(normalizedToDb(0)).toBe(-100);
  });

  it('maps 0.5 to -50 dB', () => {
    expect(normalizedToDb(0.5)).toBe(-50);
  });

  it('accepts custom floor', () => {
    expect(normalizedToDb(0, -60)).toBe(-60);
    expect(normalizedToDb(0.5, -60)).toBe(-30);
  });

  it('round-trips with dBToNormalized', () => {
    const original = -42;
    expect(normalizedToDb(dBToNormalized(original))).toBeCloseTo(original, 10);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/__tests__/dBUtils.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// packages/core/src/utils/dBUtils.ts
const DEFAULT_FLOOR = -100;

/**
 * Convert a dB value to a normalized 0-1 range.
 *
 * @param dB - Decibel value (typically -Infinity to 0)
 * @param floor - Minimum dB value mapped to 0. Default: -100 (Firefox compat)
 * @returns Clamped value between 0 and 1
 */
export function dBToNormalized(dB: number, floor: number = DEFAULT_FLOOR): number {
  if (!isFinite(dB) || dB <= floor) return 0;
  if (dB >= 0) return 1;
  return (dB - floor) / -floor;
}

/**
 * Convert a normalized 0-1 value back to dB.
 *
 * @param normalized - Value between 0 and 1
 * @param floor - Minimum dB value (maps from 0). Default: -100
 * @returns dB value
 */
export function normalizedToDb(normalized: number, floor: number = DEFAULT_FLOOR): number {
  return normalized * -floor + floor;
}
```

**Step 4: Export from utils index**

Add to `packages/core/src/utils/index.ts`:
```typescript
export * from './dBUtils';
```

**Step 5: Run test to verify it passes**

Run: `cd packages/core && npx vitest run src/__tests__/dBUtils.test.ts`
Expected: PASS (all 13 tests)

**Step 6: Commit**

```bash
git add packages/core/src/utils/dBUtils.ts packages/core/src/utils/index.ts packages/core/src/__tests__/dBUtils.test.ts
git commit -m "feat(core): add dBToNormalized and normalizedToDb utilities"
```

---

### Task 2: Multi-Channel `useMicrophoneLevel` (recording)

**Files:**
- Modify: `packages/recording/src/hooks/useMicrophoneLevel.ts`
- Modify: `packages/recording/src/hooks/useIntegratedRecording.ts`

**Context:** Tone.js `Meter` supports `channelCount` option. When `channels > 1`, `getValue()` returns `number[]` instead of `number`. The hook currently creates a single-channel Meter (line 102) and does inline dB normalization (line 129).

**Step 1: Update `UseMicrophoneLevelOptions` interface**

In `packages/recording/src/hooks/useMicrophoneLevel.ts`, add to the options interface:

```typescript
export interface UseMicrophoneLevelOptions {
  // ... existing updateRate, fftSize, smoothingTimeConstant ...

  /**
   * Number of channels to meter (1 = mono, 2 = stereo)
   * Default: 1
   */
  channelCount?: number;
}
```

**Step 2: Update `UseMicrophoneLevelReturn` interface**

```typescript
export interface UseMicrophoneLevelReturn {
  // Existing (backwards-compatible)
  level: number;
  peakLevel: number;
  resetPeak: () => void;

  /**
   * Per-channel levels (0-1).
   * Array length matches channelCount.
   */
  levels: number[];

  /**
   * Per-channel peak levels (0-1).
   * Array length matches channelCount.
   */
  peakLevels: number[];
}
```

**Step 3: Update hook implementation**

Key changes:
1. Destructure `channelCount = 1` from options
2. Create Meter with `channelCount`: `new Meter({ smoothing, context, channelCount })`
3. Replace `useState(0)` for level/peakLevel with `useState<number[]>` arrays
4. In the rAF callback, handle both `number` (single channel) and `number[]` (multi-channel) from `Meter.getValue()`
5. Use `dBToNormalized` from `@waveform-playlist/core` instead of inline `(dbValue + 100) / 100`
6. Derive backwards-compat `level`/`peakLevel` from arrays

```typescript
import { dBToNormalized } from '@waveform-playlist/core';

// Inside the hook:
const { updateRate = 60, smoothingTimeConstant = 0.8, channelCount = 1 } = options;

const [levels, setLevels] = useState<number[]>(() => new Array(channelCount).fill(0));
const [peakLevels, setPeakLevels] = useState<number[]>(() => new Array(channelCount).fill(0));

// In setupMonitoring:
const meter = new Meter({ smoothing: smoothingTimeConstant, context, channelCount });

// In updateLevel callback:
const db = meterRef.current.getValue();
const dbValues = typeof db === 'number' ? [db] : db;
const normalized = dbValues.map((v) => dBToNormalized(v));

setLevels(normalized);
setPeakLevels((prev) =>
  normalized.map((val, i) => Math.max(prev[i] ?? 0, val))
);

// Derived backwards-compat values:
const level = levels.length === 1 ? levels[0] : Math.max(...levels);
const peakLevel = peakLevels.length === 1 ? peakLevels[0] : Math.max(...peakLevels);

// Return:
return { level, peakLevel, resetPeak, levels, peakLevels };
```

**Step 4: Reset peak for all channels**

```typescript
const resetPeak = () => setPeakLevels(new Array(channelCount).fill(0));
```

**Step 5: Update `useIntegratedRecording` to pass through new fields**

In `packages/recording/src/hooks/useIntegratedRecording.ts`:
- Destructure `levels` and `peakLevels` from `useMicrophoneLevel` (line 84)
- Add to the return type and return object
- Pass `channelCount` from options through to `useMicrophoneLevel`

```typescript
// Line 84 area:
const { level, peakLevel, levels, peakLevels } = useMicrophoneLevel(stream, { channelCount });

// In IntegratedRecordingOptions, add:
channelCount?: number;

// In UseIntegratedRecordingReturn, add:
levels: number[];
peakLevels: number[];

// In return object, add:
levels,
peakLevels,
```

**Step 6: Run existing tests to verify nothing breaks**

Run: `cd packages/recording && npx vitest run`
Expected: All existing tests PASS

**Step 7: Verify the core dependency resolves**

Check that `@waveform-playlist/core` is in recording's package.json dependencies. If not, add it.

Run: `cd packages/core && pnpm build`
Run: `pnpm typecheck`
Expected: PASS

**Step 8: Commit**

```bash
git add packages/recording/src/hooks/useMicrophoneLevel.ts packages/recording/src/hooks/useIntegratedRecording.ts
git commit -m "feat(recording): add multi-channel support to useMicrophoneLevel"
```

---

### Task 3: `useOutputMeter` Hook (browser)

**Files:**
- Create: `packages/browser/src/hooks/useOutputMeter.ts`
- Modify: `packages/browser/src/hooks/index.ts`
- Modify: `packages/browser/src/index.tsx`

**Step 1: Write the hook**

```typescript
// packages/browser/src/hooks/useOutputMeter.ts
/**
 * Hook for monitoring master output levels
 *
 * Connects a Tone.js Meter to the Destination node for real-time
 * output level monitoring. Used for playback VU meters.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { Meter, getDestination, getContext } from 'tone';
import { dBToNormalized } from '@waveform-playlist/core';

export interface UseOutputMeterOptions {
  /**
   * Number of channels to meter.
   * Default: 2 (stereo output)
   */
  channelCount?: number;

  /**
   * Smoothing time constant (0-1).
   * Higher values = smoother but slower response.
   * Default: 0.8
   */
  smoothingTimeConstant?: number;

  /**
   * How often to update the levels (in Hz).
   * Default: 60 (60fps)
   */
  updateRate?: number;
}

export interface UseOutputMeterReturn {
  /** Per-channel output levels (0-1) */
  levels: number[];
  /** Per-channel peak levels (0-1) */
  peakLevels: number[];
  /** Reset all peak levels to 0 */
  resetPeak: () => void;
}

export function useOutputMeter(
  options: UseOutputMeterOptions = {}
): UseOutputMeterReturn {
  const { channelCount = 2, smoothingTimeConstant = 0.8, updateRate = 60 } = options;

  const [levels, setLevels] = useState<number[]>(() => new Array(channelCount).fill(0));
  const [peakLevels, setPeakLevels] = useState<number[]>(() => new Array(channelCount).fill(0));

  const meterRef = useRef<Meter | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const resetPeak = useCallback(
    () => setPeakLevels(new Array(channelCount).fill(0)),
    [channelCount]
  );

  useEffect(() => {
    let isMounted = true;

    const context = getContext();

    // Create Meter connected to Destination
    const meter = new Meter({
      smoothing: smoothingTimeConstant,
      context,
      channelCount,
    });
    meterRef.current = meter;

    // Connect: Destination -> Meter (Meter is a pass-through, won't affect audio)
    getDestination().connect(meter);

    // Start level monitoring
    const updateInterval = 1000 / updateRate;
    let lastUpdateTime = 0;

    const updateLevel = (timestamp: number) => {
      if (!isMounted || !meterRef.current) return;

      if (timestamp - lastUpdateTime >= updateInterval) {
        lastUpdateTime = timestamp;

        const db = meterRef.current.getValue();
        const dbValues = typeof db === 'number' ? [db] : db;
        const normalized = dbValues.map((v) => dBToNormalized(v));

        setLevels(normalized);
        setPeakLevels((prev) =>
          normalized.map((val, i) => Math.max(prev[i] ?? 0, val))
        );
      }

      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    animationFrameRef.current = requestAnimationFrame(updateLevel);

    return () => {
      isMounted = false;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (meterRef.current) {
        try {
          getDestination().disconnect(meterRef.current);
        } catch {
          console.warn('[waveform-playlist] Failed to disconnect output meter');
        }
        meterRef.current.dispose();
        meterRef.current = null;
      }
    };
  }, [channelCount, smoothingTimeConstant, updateRate]);

  return { levels, peakLevels, resetPeak };
}
```

**Step 2: Export from hooks index**

Add to `packages/browser/src/hooks/index.ts`:

```typescript
export { useOutputMeter } from './useOutputMeter';
export type { UseOutputMeterOptions, UseOutputMeterReturn } from './useOutputMeter';
```

**Step 3: Export from package index**

Add to `packages/browser/src/index.tsx` (in the hooks re-export section):

```typescript
useOutputMeter,
```

And the types:

```typescript
export type { UseOutputMeterOptions, UseOutputMeterReturn } from './hooks';
```

**Step 4: Verify typecheck passes**

Run: `cd packages/core && pnpm build && pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/browser/src/hooks/useOutputMeter.ts packages/browser/src/hooks/index.ts packages/browser/src/index.tsx
git commit -m "feat(browser): add useOutputMeter hook for master output metering"
```

---

### Task 4: `SegmentedVUMeter` Component (ui-components)

**Files:**
- Create: `packages/ui-components/src/components/SegmentedVUMeter.tsx`
- Modify: `packages/ui-components/src/components/index.tsx`
- Create: `packages/ui-components/src/__tests__/SegmentedVUMeter.test.tsx`

**Step 1: Write the failing tests**

```typescript
// packages/ui-components/src/__tests__/SegmentedVUMeter.test.tsx
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { defaultTheme } from '../wfpl-theme';
import { SegmentedVUMeter } from '../components/SegmentedVUMeter';

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={defaultTheme}>{ui}</ThemeProvider>);

describe('SegmentedVUMeter', () => {
  it('renders correct number of segments per channel', () => {
    const { container } = renderWithTheme(
      <SegmentedVUMeter levels={[0.5, 0.3]} segmentCount={12} />
    );
    // 2 channels x 12 segments = 24 segment elements
    const segments = container.querySelectorAll('[data-segment]');
    expect(segments.length).toBe(24);
  });

  it('renders channel labels', () => {
    renderWithTheme(
      <SegmentedVUMeter levels={[0.5, 0.3]} channelLabels={['L', 'R']} />
    );
    expect(screen.getByText('L')).toBeTruthy();
    expect(screen.getByText('R')).toBeTruthy();
  });

  it('defaults to L/R labels for 2 channels', () => {
    renderWithTheme(<SegmentedVUMeter levels={[0.5, 0.3]} />);
    expect(screen.getByText('L')).toBeTruthy();
    expect(screen.getByText('R')).toBeTruthy();
  });

  it('renders single channel without scale labels between channels', () => {
    const { container } = renderWithTheme(
      <SegmentedVUMeter levels={[0.5]} channelLabels={['M']} />
    );
    expect(screen.getByText('M')).toBeTruthy();
    // Should have 1 channel column
    const channels = container.querySelectorAll('[data-channel]');
    expect(channels.length).toBe(1);
  });

  it('renders dB scale labels when showScale is true', () => {
    renderWithTheme(
      <SegmentedVUMeter levels={[0.5, 0.3]} showScale />
    );
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText('-20')).toBeTruthy();
  });

  it('hides dB scale labels when showScale is false', () => {
    renderWithTheme(
      <SegmentedVUMeter levels={[0.5, 0.3]} showScale={false} />
    );
    expect(screen.queryByText('-20')).toBeNull();
  });

  it('renders peak indicators when peakLevels provided', () => {
    const { container } = renderWithTheme(
      <SegmentedVUMeter levels={[0.3]} peakLevels={[0.8]} channelLabels={['M']} />
    );
    const peaks = container.querySelectorAll('[data-peak]');
    expect(peaks.length).toBe(1);
  });

  it('applies horizontal orientation', () => {
    const { container } = renderWithTheme(
      <SegmentedVUMeter levels={[0.5]} orientation="horizontal" channelLabels={['M']} />
    );
    const meter = container.querySelector('[data-meter-orientation="horizontal"]');
    expect(meter).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/ui-components && npx vitest run src/__tests__/SegmentedVUMeter.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement the component**

Create `packages/ui-components/src/components/SegmentedVUMeter.tsx`:

```typescript
/**
 * Segmented VU Meter Component
 *
 * Professional LED-segment style audio level meter.
 * Supports multi-channel, vertical/horizontal orientation,
 * custom colors, dB scale labels, and peak hold indicators.
 */

import React, { useMemo } from 'react';
import styled from 'styled-components';
import { normalizedToDb } from '@waveform-playlist/core';

// --- Types ---

export interface ColorStop {
  /** dB threshold for this color */
  dB: number;
  /** CSS color value */
  color: string;
}

export interface SegmentedVUMeterProps {
  /** Per-channel levels, 0-1. Array length = number of channels. */
  levels: number[];
  /** Per-channel peak levels, 0-1. Optional peak hold indicators. */
  peakLevels?: number[];
  /** Channel labels (e.g., ['L', 'R']). Defaults to ['L','R'] for 2ch, ['M'] for 1ch. */
  channelLabels?: string[];
  /** Orientation. Default: 'vertical' */
  orientation?: 'vertical' | 'horizontal';
  /** Number of LED segments. Default: 24 */
  segmentCount?: number;
  /** dB range [min, max]. Default: [-50, 5] */
  dBRange?: [number, number];
  /** Show dB scale labels between channels. Default: true */
  showScale?: boolean;
  /** Custom color stops (sorted high to low dB). Uses default DAW-style if omitted. */
  colorStops?: ColorStop[];
  /** Segment width in pixels. Default: 20 */
  segmentWidth?: number;
  /** Segment height in pixels. Default: 8 */
  segmentHeight?: number;
  /** Gap between segments in pixels. Default: 2 */
  segmentGap?: number;
  /** Additional CSS class name */
  className?: string;
}

// --- Default color stops (matching issue #241 DAW-style image) ---

const DEFAULT_COLOR_STOPS: ColorStop[] = [
  { dB: 2, color: '#e74c3c' },    // Red - clipping zone
  { dB: 0, color: '#e67e22' },    // Orange
  { dB: -2, color: '#f1c40f' },   // Yellow
  { dB: -5, color: '#2ecc71' },   // Green - nominal
  { dB: -8, color: '#27ae60' },   // Darker green
  { dB: -15, color: '#5dade2' },  // Light blue
  { dB: -50, color: '#85c1e9' },  // Pale blue - quiet
];

const DEFAULT_LABELS_2CH = ['L', 'R'];
const DEFAULT_LABELS_1CH = ['M'];

// --- Helpers ---

function getColorForDb(dB: number, colorStops: ColorStop[]): string {
  for (const stop of colorStops) {
    if (dB >= stop.dB) return stop.color;
  }
  return colorStops[colorStops.length - 1].color;
}

function getDefaultLabels(channelCount: number): string[] {
  if (channelCount === 2) return DEFAULT_LABELS_2CH;
  if (channelCount === 1) return DEFAULT_LABELS_1CH;
  return Array.from({ length: channelCount }, (_, i) => String(i + 1));
}

/** Compute the dB thresholds for each segment, from top (max) to bottom (min). */
function computeSegmentThresholds(
  segmentCount: number,
  dBRange: [number, number]
): number[] {
  const [minDb, maxDb] = dBRange;
  const range = maxDb - minDb;
  return Array.from({ length: segmentCount }, (_, i) => {
    return maxDb - (i * range) / (segmentCount - 1);
  });
}

/** Select a subset of segment indices to show dB labels. */
function computeScaleLabels(thresholds: number[]): Array<{ index: number; label: string }> {
  // Show labels at roughly even intervals, including first and last
  const count = thresholds.length;
  const targetLabelCount = Math.min(12, count);
  const step = Math.max(1, Math.floor(count / targetLabelCount));

  const labels: Array<{ index: number; label: string }> = [];
  for (let i = 0; i < count; i += step) {
    labels.push({ index: i, label: String(Math.round(thresholds[i])) });
  }
  // Always include the last segment
  if (labels[labels.length - 1].index !== count - 1) {
    labels.push({ index: count - 1, label: String(Math.round(thresholds[count - 1])) });
  }
  return labels;
}

// --- Styled Components ---

const MeterContainer = styled.div`
  display: inline-flex;
  background: #1a1a2e;
  border-radius: 4px;
  padding: 8px;
  gap: 2px;
`;

const ChannelColumn = styled.div<{ $orientation: 'vertical' | 'horizontal' }>`
  display: flex;
  flex-direction: ${(p) => (p.$orientation === 'vertical' ? 'column' : 'row')};
  align-items: center;
  gap: 0;
`;

const ScaleColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
`;

const ScaleLabel = styled.span`
  font-size: 9px;
  font-family: 'Courier New', monospace;
  color: #a0a0a0;
  line-height: 1;
  white-space: nowrap;
`;

const ChannelLabel = styled.span`
  font-size: 10px;
  font-family: 'Courier New', monospace;
  font-weight: bold;
  color: #e0e0e0;
  text-align: center;
  padding: 4px 0 0;
`;

// Use .attrs() for the active/inactive state to avoid generating CSS classes per render
const Segment = styled.div.attrs<{
  $active: boolean;
  $peak: boolean;
  $color: string;
  $dimColor: string;
  $width: number;
  $height: number;
  $gap: number;
}>((props) => ({
  style: {
    width: `${props.$width}px`,
    height: `${props.$height}px`,
    marginBottom: `${props.$gap}px`,
    backgroundColor: props.$peak
      ? '#ffffff'
      : props.$active
        ? props.$color
        : props.$dimColor,
    boxShadow: props.$peak
      ? `0 0 4px ${props.$color}`
      : props.$active
        ? `0 0 3px ${props.$color}40`
        : 'none',
  },
}))<{
  $active: boolean;
  $peak: boolean;
  $color: string;
  $dimColor: string;
  $width: number;
  $height: number;
  $gap: number;
}>`
  border-radius: 1px;
  transition: background-color 0.05s ease-out;
`;

// --- Component ---

const SegmentedVUMeterComponent: React.FC<SegmentedVUMeterProps> = ({
  levels,
  peakLevels,
  channelLabels,
  orientation = 'vertical',
  segmentCount = 24,
  dBRange = [-50, 5],
  showScale = true,
  colorStops,
  segmentWidth = 20,
  segmentHeight = 8,
  segmentGap = 2,
  className,
}) => {
  const effectiveColorStops = colorStops ?? DEFAULT_COLOR_STOPS;
  const effectiveLabels = channelLabels ?? getDefaultLabels(levels.length);

  const thresholds = useMemo(
    () => computeSegmentThresholds(segmentCount, dBRange),
    [segmentCount, dBRange]
  );

  const scaleLabels = useMemo(
    () => (showScale ? computeScaleLabels(thresholds) : []),
    [showScale, thresholds]
  );

  // Convert normalized levels to dB for threshold comparison
  const levelsDbs = useMemo(
    () => levels.map((l) => normalizedToDb(l)),
    [levels]
  );

  const peakDbs = useMemo(
    () => peakLevels?.map((p) => normalizedToDb(p)),
    [peakLevels]
  );

  // Build scale label map for O(1) lookup
  const scaleLabelMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const { index, label } of scaleLabels) {
      map.set(index, label);
    }
    return map;
  }, [scaleLabels]);

  return (
    <MeterContainer
      className={className}
      data-meter-orientation={orientation}
    >
      {levels.map((_, channelIndex) => (
        <React.Fragment key={channelIndex}>
          {/* Scale labels between first and second channel */}
          {showScale && channelIndex === 1 && (
            <ScaleColumn>
              {thresholds.map((_, segIdx) => (
                <ScaleLabel
                  key={segIdx}
                  style={{
                    height: `${segmentHeight + segmentGap}px`,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {scaleLabelMap.get(segIdx) ?? ''}
                </ScaleLabel>
              ))}
              <div style={{ height: 0 }} /> {/* spacer for channel label row */}
            </ScaleColumn>
          )}

          <ChannelColumn $orientation={orientation} data-channel>
            {thresholds.map((thresholdDb, segIdx) => {
              const isActive = levelsDbs[channelIndex] >= thresholdDb;
              const isPeak =
                peakDbs !== undefined &&
                peakDbs[channelIndex] !== undefined &&
                Math.abs(peakDbs[channelIndex] - thresholdDb) <
                  (dBRange[1] - dBRange[0]) / segmentCount;
              const color = getColorForDb(thresholdDb, effectiveColorStops);
              const dimColor = `${color}20`; // 12% opacity

              return (
                <Segment
                  key={segIdx}
                  data-segment
                  data-peak={isPeak || undefined}
                  $active={isActive}
                  $peak={isPeak && !isActive}
                  $color={color}
                  $dimColor={dimColor}
                  $width={segmentWidth}
                  $height={segmentHeight}
                  $gap={segmentGap}
                />
              );
            })}
            <ChannelLabel>{effectiveLabels[channelIndex]}</ChannelLabel>
          </ChannelColumn>
        </React.Fragment>
      ))}

      {/* Scale labels for single channel — show to the right */}
      {showScale && levels.length === 1 && (
        <ScaleColumn>
          {thresholds.map((_, segIdx) => (
            <ScaleLabel
              key={segIdx}
              style={{
                height: `${segmentHeight + segmentGap}px`,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {scaleLabelMap.get(segIdx) ?? ''}
            </ScaleLabel>
          ))}
        </ScaleColumn>
      )}
    </MeterContainer>
  );
};

export const SegmentedVUMeter = React.memo(SegmentedVUMeterComponent);
```

**Step 4: Export from components index**

Add to `packages/ui-components/src/components/index.tsx`:

```typescript
export * from './SegmentedVUMeter';
```

**Step 5: Run tests to verify they pass**

Run: `cd packages/ui-components && npx vitest run src/__tests__/SegmentedVUMeter.test.tsx`
Expected: PASS (all 8 tests)

**Step 6: Commit**

```bash
git add packages/ui-components/src/components/SegmentedVUMeter.tsx packages/ui-components/src/components/index.tsx packages/ui-components/src/__tests__/SegmentedVUMeter.test.tsx
git commit -m "feat(ui-components): add SegmentedVUMeter component"
```

---

### Task 5: Storybook Stories

**Files:**
- Create: `packages/ui-components/src/stories/SegmentedVUMeter.stories.tsx`

**Step 1: Write stories**

```typescript
// packages/ui-components/src/stories/SegmentedVUMeter.stories.tsx
import React, { useState, useEffect } from 'react';
import { ThemeProvider } from 'styled-components';
import { defaultTheme } from '../wfpl-theme';
import { SegmentedVUMeter } from '../components/SegmentedVUMeter';

export default {
  title: 'Components/SegmentedVUMeter',
};

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={defaultTheme}>
    <div style={{ padding: '2rem', background: '#111' }}>{children}</div>
  </ThemeProvider>
);

export const StereoVertical = () => (
  <Wrapper>
    <SegmentedVUMeter levels={[0.65, 0.45]} peakLevels={[0.8, 0.6]} />
  </Wrapper>
);

export const MonoVertical = () => (
  <Wrapper>
    <SegmentedVUMeter levels={[0.7]} peakLevels={[0.85]} channelLabels={['M']} />
  </Wrapper>
);

export const Horizontal = () => (
  <Wrapper>
    <SegmentedVUMeter
      levels={[0.6, 0.4]}
      orientation="horizontal"
      segmentWidth={8}
      segmentHeight={20}
    />
  </Wrapper>
);

export const CustomColors = () => (
  <Wrapper>
    <SegmentedVUMeter
      levels={[0.7, 0.5]}
      colorStops={[
        { dB: 0, color: '#ff0066' },
        { dB: -10, color: '#ff9900' },
        { dB: -30, color: '#00ff88' },
        { dB: -50, color: '#0088ff' },
      ]}
    />
  </Wrapper>
);

export const Animated = () => {
  const [levels, setLevels] = useState([0.3, 0.3]);
  const [peaks, setPeaks] = useState([0.3, 0.3]);

  useEffect(() => {
    const interval = setInterval(() => {
      const newLevels = [
        Math.max(0, Math.min(1, levels[0] + (Math.random() - 0.5) * 0.15)),
        Math.max(0, Math.min(1, levels[1] + (Math.random() - 0.5) * 0.15)),
      ];
      setLevels(newLevels);
      setPeaks((prev) => [
        Math.max(prev[0] * 0.995, newLevels[0]),
        Math.max(prev[1] * 0.995, newLevels[1]),
      ]);
    }, 50);
    return () => clearInterval(interval);
  });

  return (
    <Wrapper>
      <SegmentedVUMeter levels={levels} peakLevels={peaks} />
    </Wrapper>
  );
};

export const CompactSize = () => (
  <Wrapper>
    <SegmentedVUMeter
      levels={[0.6, 0.4]}
      segmentWidth={12}
      segmentHeight={5}
      segmentGap={1}
      segmentCount={16}
    />
  </Wrapper>
);

export const NoScale = () => (
  <Wrapper>
    <SegmentedVUMeter levels={[0.7, 0.5]} showScale={false} />
  </Wrapper>
);
```

**Step 2: Commit**

```bash
git add packages/ui-components/src/stories/SegmentedVUMeter.stories.tsx
git commit -m "feat(ui-components): add SegmentedVUMeter storybook stories"
```

---

### Task 6: Update Recording Example (website)

**Files:**
- Modify: `website/src/components/examples/RecordingExample.tsx`

**Step 1: Import new components and hooks**

Add imports:
```typescript
import { SegmentedVUMeter } from '@waveform-playlist/ui-components';
import { useOutputMeter } from '@waveform-playlist/browser';
```

**Step 2: Add `useOutputMeter` inside `RecordingControlsInner`**

After the existing `useIntegratedRecording` call:
```typescript
const { levels: outputLevels, peakLevels: outputPeaks } = useOutputMeter({ channelCount: 2 });
```

**Step 3: Update `useIntegratedRecording` to request stereo**

Update the options to include `channelCount: 2`:
```typescript
const {
  // ... existing destructured fields ...
  levels: inputLevels,
  peakLevels: inputPeaks,
} = useIntegratedRecording(tracks, setTracks, selectedTrackId, {
  currentTime,
  channelCount: 2,
});
```

**Step 4: Replace the horizontal VUMeter with SegmentedVUMeters**

Replace the `VUMeterWrapper` block (lines 283-286) with:

```tsx
{hasPermission && (
  <Flex gap="4" align="start" style={{ marginTop: '0.75rem' }}>
    <div>
      <Label style={{ display: 'block', marginBottom: '0.25rem' }}>Input</Label>
      <SegmentedVUMeter
        levels={inputLevels}
        peakLevels={inputPeaks}
        segmentCount={20}
        segmentWidth={16}
        segmentHeight={6}
        segmentGap={1}
      />
    </div>
    <div>
      <Label style={{ display: 'block', marginBottom: '0.25rem' }}>Output</Label>
      <SegmentedVUMeter
        levels={outputLevels}
        peakLevels={outputPeaks}
        segmentCount={20}
        segmentWidth={16}
        segmentHeight={6}
        segmentGap={1}
      />
    </div>
  </Flex>
)}
```

**Step 5: Remove old VUMeter import if no longer used**

Remove `VUMeter` from the `@waveform-playlist/recording` import if no longer referenced.

**Step 6: Verify the example builds**

Run: `pnpm build && pnpm --filter website build`
Expected: PASS (CSS calc warnings are pre-existing, harmless)

**Step 7: Commit**

```bash
git add website/src/components/examples/RecordingExample.tsx
git commit -m "feat(website): upgrade recording example with segmented VU meters"
```

---

### Task 7: VU Meters Guide Doc (website)

**Files:**
- Create: `website/docs/guides/vu-meters.md`

**Step 1: Write the guide**

Create `website/docs/guides/vu-meters.md` with these sections:

1. **Overview** — What VU meters are available, when to use each
2. **Built-In Components** — `VUMeter` (simple) and `SegmentedVUMeter` (professional)
3. **Input Metering** — `useMicrophoneLevel` with `channelCount` for stereo
4. **Output Metering** — `useOutputMeter` for playback levels
5. **Building a Custom Meter** — Complete example consuming `useMicrophoneLevel` and rendering a canvas-based or div-based custom visualization. This is the core answer to issue #241.
6. **Multi-Channel Configuration** — How `channelCount` maps to Tone.js Meter channels

Include code examples for each section. The "Building a Custom Meter" section should show:
- How to get per-channel data from the hooks
- A complete custom React component that renders levels as a canvas or styled divs
- How `dBToNormalized` / `normalizedToDb` work for custom dB-scale rendering

**Step 2: Verify docs build**

Run: `pnpm --filter website build`
Expected: PASS (sidebar auto-generates from directory)

**Step 3: Commit**

```bash
git add website/docs/guides/vu-meters.md
git commit -m "docs: add VU meters guide with custom meter tutorial"
```

---

### Task 8: Update Existing Docs

**Files:**
- Modify: `website/docs/guides/recording.md` (Level Monitoring section, ~lines 287-368)
- Modify: `website/docs/api/hooks.md` (add useOutputMeter, update useMicrophoneLevel)
- Modify: `website/docs/api/llm-reference.md` (add new interfaces)
- Modify: `website/static/llms.txt` (mention VU meter capabilities)

**Step 1: Update recording.md**

In the "Level Monitoring" section:
- Update `useMicrophoneLevel` example to show `levels`/`peakLevels` arrays
- Add note about `channelCount` option for stereo
- Add link: "For advanced metering including output meters and custom visualizations, see the [VU Meters guide](./vu-meters.md)."

**Step 2: Update hooks.md**

- Add `useOutputMeter` section with interface and example
- Update `useMicrophoneLevel` section to show new return fields

**Step 3: Update llm-reference.md**

Add `UseOutputMeterOptions`, `UseOutputMeterReturn`, `SegmentedVUMeterProps`, `ColorStop` interfaces.

**Step 4: Update llms.txt**

In the features/capabilities section, mention multi-channel VU metering.

**Step 5: Verify docs build**

Run: `pnpm --filter website build`
Expected: PASS

**Step 6: Commit**

```bash
git add website/docs/guides/recording.md website/docs/api/hooks.md website/docs/api/llm-reference.md website/static/llms.txt
git commit -m "docs: update recording guide and API reference for multi-channel metering"
```

---

### Task 9: Final Verification

**Step 1: Run all unit tests**

```bash
cd packages/core && npx vitest run
cd packages/ui-components && npx vitest run
cd packages/recording && npx vitest run
cd packages/browser && npx vitest run
```

Expected: All PASS

**Step 2: Full build + typecheck + lint**

```bash
pnpm build && pnpm typecheck && pnpm lint
```

Expected: PASS

**Step 3: Verify website builds**

```bash
pnpm --filter website build
```

Expected: PASS

**Step 4: Kill any orphaned vitest processes**

```bash
pkill -f vitest 2>/dev/null || true
```

**Step 5: Final commit if any fixes needed, then summarize**

All tasks complete. Ready for PR.
