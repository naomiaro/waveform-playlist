import React, { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import styled from 'styled-components';
import { normalizedToDb, type MeterLevels, type MeterSource } from '@waveform-playlist/core';

export interface ColorStop {
  dB: number;
  color: string;
}

export interface SegmentedVUMeterProps {
  /**
   * A live meter (`useOutputMeter().meter`, `useMicrophoneLevel().meter`).
   * The component draws each new value straight to the DOM and does not
   * re-render for it. Takes precedence over `levels` / `peakLevels`.
   */
  meter?: MeterSource;
  /** Per-channel levels (0-1) for a meter driven by props. */
  levels?: number[];
  peakLevels?: number[];
  channelLabels?: string[];
  orientation?: 'vertical' | 'horizontal';
  segmentCount?: number;
  dBRange?: [number, number];
  showScale?: boolean;
  colorStops?: ColorStop[];
  segmentWidth?: number;
  segmentHeight?: number;
  segmentGap?: number;
  coloredInactive?: boolean;
  /** Color for scale labels and channel labels. Defaults to '#888'. */
  labelColor?: string;
  className?: string;
}

const DEFAULT_COLOR_STOPS: ColorStop[] = [
  { dB: 2, color: '#ff0000' },
  { dB: -1, color: '#e74c3c' },
  { dB: -3, color: '#e67e22' },
  { dB: -6, color: '#f1c40f' },
  { dB: -12, color: '#2ecc71' },
  { dB: -20, color: '#27ae60' },
  { dB: -30, color: '#5dade2' },
  { dB: -50, color: '#85c1e9' },
];

const INACTIVE_OPACITY = 0.15;
const INACTIVE_COLOR = 'rgba(128, 128, 128, 0.2)';
const PEAK_COLOR = '#ffffff';

function getDefaultLabels(channelCount: number): string[] {
  if (channelCount === 1) return ['M'];
  if (channelCount === 2) return ['L', 'R'];
  return Array.from({ length: channelCount }, (_, i) => String(i + 1));
}

function getColorForDb(dB: number, colorStops: ColorStop[]): string {
  if (colorStops.length === 0) return INACTIVE_COLOR;
  for (const stop of colorStops) {
    if (dB >= stop.dB) {
      return stop.color;
    }
  }
  return colorStops[colorStops.length - 1].color;
}

/** Index of the threshold closest to `dB`: where the peak marker sits. */
function closestThresholdIndex(thresholds: number[], dB: number): number {
  let index = -1;
  let minDist = Infinity;
  for (let i = 0; i < thresholds.length; i++) {
    const dist = Math.abs(thresholds[i] - dB);
    if (dist < minDist) {
      minDist = dist;
      index = i;
    }
  }
  return index;
}

interface SegmentVisual {
  backgroundColor: string;
  opacity: string;
  boxShadow: string;
}

/** The three style values that depend on a segment's state. */
function segmentVisual(
  active: boolean,
  isPeak: boolean,
  color: string,
  coloredInactive: boolean
): SegmentVisual {
  return {
    backgroundColor: isPeak ? PEAK_COLOR : active || coloredInactive ? color : INACTIVE_COLOR,
    opacity: isPeak || active ? '1' : coloredInactive ? String(INACTIVE_OPACITY) : '1',
    boxShadow: active || isPeak ? `0 0 4px ${isPeak ? PEAK_COLOR : color}40` : 'none',
  };
}

const NO_LEVELS: number[] = [];
const subscribeToNothing = () => () => {};
/** Channel-count selector result when there is no `meter` prop. */
const NO_METER = -1;

function computeThresholds(segmentCount: number, dBRange: [number, number]): number[] {
  const safeCount = Math.max(2, segmentCount);
  const [minDb, maxDb] = dBRange;
  const step = (maxDb - minDb) / (safeCount - 1);
  return Array.from({ length: safeCount }, (_, i) => maxDb - i * step);
}

function formatDbLabel(dB: number): string {
  return Math.round(dB).toString();
}

// --- Styled Components ---

const MeterContainer = styled.div<{ $orientation: 'vertical' | 'horizontal' }>`
  display: inline-flex;
  flex-direction: ${(props) => (props.$orientation === 'horizontal' ? 'column' : 'row')};
  gap: 4px;
  font-family: 'Courier New', monospace;
`;

const ChannelColumn = styled.div<{ $orientation: 'vertical' | 'horizontal' }>`
  display: flex;
  flex-direction: ${(props) => (props.$orientation === 'horizontal' ? 'row' : 'column')};
  align-items: center;
  gap: 4px;
`;

const SegmentStack = styled.div<{ $orientation: 'vertical' | 'horizontal' }>`
  display: flex;
  flex-direction: ${(props) => (props.$orientation === 'horizontal' ? 'row' : 'column')};
`;

interface SegmentStyleProps {
  $width: number;
  $height: number;
  $gap: number;
  $active: boolean;
  $color: string;
  $isPeak: boolean;
  $orientation: 'vertical' | 'horizontal';
  $coloredInactive: boolean;
}

const Segment = styled.div.attrs<SegmentStyleProps>((props) => ({
  style: {
    width: `${props.$width}px`,
    height: `${props.$height}px`,
    ...(props.$orientation === 'horizontal'
      ? { marginRight: `${props.$gap}px` }
      : { marginBottom: `${props.$gap}px` }),
    ...segmentVisual(props.$active, props.$isPeak, props.$color, props.$coloredInactive),
  },
}))<SegmentStyleProps>`
  border-radius: 1px;
`;

const DEFAULT_LABEL_COLOR = '#888';

const ChannelLabel = styled.div<{ $labelColor: string }>`
  color: ${(props) => props.$labelColor};
  font-size: 10px;
  text-align: center;
  user-select: none;
`;

const ScaleColumn = styled.div`
  display: flex;
  flex-direction: column;
  position: relative;
  min-width: 28px;
`;

interface ScaleLabelStyleProps {
  $top: number;
}

interface ScaleLabelAllProps extends ScaleLabelStyleProps {
  $labelColor: string;
}

const ScaleLabel = styled.div.attrs<ScaleLabelAllProps>((props) => ({
  style: {
    top: `${props.$top}px`,
    color: props.$labelColor,
  },
}))<ScaleLabelAllProps>`
  position: absolute;
  left: 50%;
  font-size: 9px;
  font-family: 'Courier New', monospace;
  white-space: nowrap;
  transform: translate(-50%, -50%);
  user-select: none;
`;

const HorizontalScaleWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
`;

const ScaleRow = styled.div`
  display: flex;
  flex-direction: row;
  position: relative;
  min-height: 16px;
`;

interface ScaleLabelHorizontalStyleProps {
  $left: number;
}

interface ScaleLabelHorizontalAllProps extends ScaleLabelHorizontalStyleProps {
  $labelColor: string;
}

const ScaleLabelHorizontal = styled.div.attrs<ScaleLabelHorizontalAllProps>((props) => ({
  style: {
    left: `${props.$left}px`,
    color: props.$labelColor,
  },
}))<ScaleLabelHorizontalAllProps>`
  position: absolute;
  top: 50%;
  font-size: 9px;
  font-family: 'Courier New', monospace;
  white-space: nowrap;
  transform: translate(-50%, -50%);
  user-select: none;
`;

// --- Component ---

const SegmentedVUMeterInner: React.FC<SegmentedVUMeterProps> = ({
  meter,
  levels: levelsProp,
  peakLevels: peakLevelsProp,
  channelLabels,
  orientation = 'vertical',
  segmentCount = 24,
  dBRange = [-50, 5],
  showScale = true,
  colorStops = DEFAULT_COLOR_STOPS,
  segmentWidth = 20,
  segmentHeight = 8,
  segmentGap = 2,
  coloredInactive = false,
  labelColor,
  className,
}) => {
  // With a meter, the only thing that re-renders this component is a change
  // in the number of channels (a microphone's count is known once its stream
  // is set up). Levels are drawn by the subscription further down.
  // The source's functions are called as methods, so one written as a class works.
  const subscribeToMeter = useCallback(
    (onChange: () => void) => (meter ? meter.subscribe(onChange) : subscribeToNothing()),
    [meter]
  );
  const getMeterChannelCount = useCallback(
    () => (meter ? meter.getSnapshot().levels.length : NO_METER),
    [meter]
  );
  const meterChannelCount = useSyncExternalStore(
    subscribeToMeter,
    getMeterChannelCount,
    getMeterChannelCount
  );
  // Read during render so the first paint, and any later render, shows the
  // same values the subscription last drew.
  const meterSnapshot: MeterLevels | null = meter ? meter.getSnapshot() : null;
  const levels = meterSnapshot ? meterSnapshot.levels : (levelsProp ?? NO_LEVELS);
  const peakLevels = meterSnapshot ? meterSnapshot.peakLevels : peakLevelsProp;
  const containerRef = useRef<HTMLDivElement>(null);
  // Set while a meter is attached: writes the current value to every segment.
  const redrawRef = useRef<(() => void) | null>(null);
  // The segments are remounted when the component switches between a meter and
  // the `levels` prop, so nothing the subscription drew outlives the meter.
  const sourceKey = meter ? 'meter' : 'props';

  const channelCount = meter ? meterChannelCount : levels.length;
  const labels = channelLabels ?? getDefaultLabels(channelCount);
  const resolvedLabelColor = labelColor ?? DEFAULT_LABEL_COLOR;

  if (
    process.env.NODE_ENV !== 'production' &&
    peakLevels != null &&
    peakLevels.length !== channelCount
  ) {
    console.warn(
      `[waveform-playlist] SegmentedVUMeter: peakLevels length (${peakLevels.length}) does not match levels length (${channelCount})`
    );
  }

  const isMultiChannel = channelCount >= 2;
  const segmentTotalHeight = segmentHeight + segmentGap;

  // Destructure dBRange into stable primitives for useMemo deps.
  // Inline array literals like dBRange={[-50, 5]} create a new reference
  // each render, which would cause useMemo to recompute at 60fps.
  const [dBMin, dBMax] = dBRange;

  const thresholds = useMemo(
    () => computeThresholds(segmentCount, [dBMin, dBMax]),
    [segmentCount, dBMin, dBMax]
  );

  const scaleLabels = useMemo(() => {
    const totalSize = segmentCount * segmentTotalHeight - segmentGap;
    const minDb = dBMin;
    const maxDb = dBMax;
    let minSpacing: number;
    if (orientation === 'horizontal') {
      minSpacing = 35;
    } else {
      minSpacing = Math.max(14, segmentTotalHeight * 2);
    }
    const labelCount = Math.max(2, Math.floor(totalSize / minSpacing));

    // Position labels at evenly-spaced pixel positions (not snapped to segments)
    const labels: { position: number; label: string }[] = [];
    for (let i = 0; i < labelCount; i++) {
      const t = i / (labelCount - 1);
      const position = t * totalSize;
      // Vertical: top=0 is maxDb, bottom is minDb
      // Horizontal: left=0 is minDb, right is maxDb
      const db =
        orientation === 'horizontal' ? minDb + t * (maxDb - minDb) : maxDb - t * (maxDb - minDb);
      labels.push({ position, label: formatDbLabel(db) });
    }
    return labels;
  }, [orientation, segmentCount, segmentTotalHeight, segmentGap, dBMin, dBMax]);

  // For horizontal, reverse thresholds so low dB is on left, high dB on right
  const renderThresholds = useMemo(
    () => (orientation === 'horizontal' ? [...thresholds].reverse() : thresholds),
    [thresholds, orientation]
  );

  // Both inputs are stable between level updates, so the colours are looked
  // up once per threshold set rather than once per segment per frame.
  const segmentColors = useMemo(
    () => renderThresholds.map((threshold) => getColorForDb(threshold, colorStops)),
    [renderThresholds, colorStops]
  );

  // Draw each published value directly: only segments whose state changed are
  // touched, and React does not render.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!meter || !container) return;

    const channels = Array.from(container.querySelectorAll<HTMLElement>('[data-channel]')).map(
      (channel) => Array.from(channel.querySelectorAll<HTMLElement>('[data-segment]'))
    );
    // What each segment currently shows: bit 0 lit, bit 1 peak marker.
    // 255 = unknown, so the first pass writes every segment.
    const drawn = channels.map((segments) => new Uint8Array(segments.length).fill(255));

    const draw = (value: MeterLevels) => {
      for (let ch = 0; ch < channels.length; ch++) {
        const segments = channels[ch];
        const levelDb = normalizedToDb(value.levels[ch] ?? 0);
        const peak = value.peakLevels[ch];
        const peakIndex =
          peak === undefined ? -1 : closestThresholdIndex(renderThresholds, normalizedToDb(peak));
        for (let i = 0; i < segments.length; i++) {
          const active = levelDb >= renderThresholds[i];
          const isPeak = i === peakIndex;
          const state = (active ? 1 : 0) | (isPeak ? 2 : 0);
          if (drawn[ch][i] === state) continue;
          drawn[ch][i] = state;
          const segment = segments[i];
          const visual = segmentVisual(active, isPeak, segmentColors[i], coloredInactive);
          segment.style.backgroundColor = visual.backgroundColor;
          segment.style.opacity = visual.opacity;
          segment.style.boxShadow = visual.boxShadow;
          segment.toggleAttribute('data-peak', isPeak);
        }
      }
    };

    redrawRef.current = () => {
      for (const states of drawn) states.fill(255);
      draw(meter.getSnapshot());
    };
    const unsubscribe = meter.subscribe((value) => draw(value));
    return () => {
      unsubscribe();
      redrawRef.current = null;
    };
  }, [meter, channelCount, renderThresholds, segmentColors, coloredInactive, orientation]);

  // After every commit, write the current value again. React only writes the
  // styles that differ from its previous render, which is not always what the
  // subscription last drew: a value published between a render and its commit
  // would otherwise be overwritten by the older render's styles and stay
  // wrong until that segment next changes.
  useLayoutEffect(() => {
    redrawRef.current?.();
  });

  const renderChannel = (channelIndex: number) => {
    const level = levels[channelIndex] ?? 0;
    const levelDb = normalizedToDb(level);
    const peak = peakLevels?.[channelIndex];
    const peakSegmentIndex =
      peak === undefined ? -1 : closestThresholdIndex(renderThresholds, normalizedToDb(peak));

    return (
      <ChannelColumn key={channelIndex} $orientation={orientation} data-channel>
        {orientation === 'horizontal' && (
          <ChannelLabel $labelColor={resolvedLabelColor}>{labels[channelIndex]}</ChannelLabel>
        )}
        <SegmentStack $orientation={orientation}>
          {renderThresholds.map((threshold, segIdx) => {
            const active = levelDb >= threshold;
            const isPeak = segIdx === peakSegmentIndex;
            const color = segmentColors[segIdx];

            return (
              <Segment
                key={segIdx}
                $width={orientation === 'horizontal' ? segmentHeight : segmentWidth}
                $height={orientation === 'horizontal' ? segmentWidth : segmentHeight}
                $gap={segmentGap}
                $active={active}
                $color={color}
                $isPeak={isPeak}
                $orientation={orientation}
                $coloredInactive={coloredInactive}
                data-segment
                {...(isPeak ? { 'data-peak': '' } : {})}
              />
            );
          })}
        </SegmentStack>
        {orientation === 'vertical' && (
          <ChannelLabel $labelColor={resolvedLabelColor}>{labels[channelIndex]}</ChannelLabel>
        )}
      </ChannelColumn>
    );
  };

  const renderScale = () => {
    if (orientation === 'horizontal') {
      const totalWidth = segmentCount * segmentTotalHeight - segmentGap;
      return (
        <HorizontalScaleWrapper>
          <ChannelLabel $labelColor={resolvedLabelColor} style={{ visibility: 'hidden' }}>
            L
          </ChannelLabel>
          <ScaleRow style={{ width: `${totalWidth}px` }}>
            {scaleLabels.map(({ position, label }, i) => (
              <ScaleLabelHorizontal key={i} $left={position} $labelColor={resolvedLabelColor}>
                {label}
              </ScaleLabelHorizontal>
            ))}
          </ScaleRow>
        </HorizontalScaleWrapper>
      );
    }
    const totalHeight = segmentCount * segmentTotalHeight - segmentGap;
    return (
      <ScaleColumn style={{ height: `${totalHeight}px` }}>
        {scaleLabels.map(({ position, label }, i) => (
          <ScaleLabel key={i} $top={position} $labelColor={resolvedLabelColor}>
            {label}
          </ScaleLabel>
        ))}
      </ScaleColumn>
    );
  };

  if (isMultiChannel) {
    if (orientation === 'horizontal') {
      // Horizontal: channels stacked vertically, scale below
      return (
        <MeterContainer
          key={sourceKey}
          ref={containerRef}
          className={className}
          $orientation={orientation}
          data-meter-orientation={orientation}
        >
          {Array.from({ length: channelCount }, (_, i) => renderChannel(i))}
          {showScale && renderScale()}
        </MeterContainer>
      );
    }
    // Vertical: channels on sides, scale in middle
    const midpoint = Math.ceil(channelCount / 2);
    const leftChannels = Array.from({ length: midpoint }, (_, i) => i);
    const rightChannels = Array.from({ length: channelCount - midpoint }, (_, i) => midpoint + i);

    return (
      <MeterContainer
        key={sourceKey}
        ref={containerRef}
        className={className}
        $orientation={orientation}
        data-meter-orientation={orientation}
      >
        {leftChannels.map(renderChannel)}
        {showScale && renderScale()}
        {rightChannels.map(renderChannel)}
      </MeterContainer>
    );
  }

  // Single channel: channel on left, scale on right (vertical) or below (horizontal)
  return (
    <MeterContainer
      key={sourceKey}
      ref={containerRef}
      className={className}
      $orientation={orientation}
      data-meter-orientation={orientation}
    >
      {renderChannel(0)}
      {showScale && renderScale()}
    </MeterContainer>
  );
};

export const SegmentedVUMeter = React.memo(SegmentedVUMeterInner);
