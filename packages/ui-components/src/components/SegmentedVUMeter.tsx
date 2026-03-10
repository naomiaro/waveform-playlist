import React, { useMemo } from 'react';
import styled from 'styled-components';
import { normalizedToDb } from '@waveform-playlist/core';

export interface ColorStop {
  dB: number;
  color: string;
}

export interface SegmentedVUMeterProps {
  levels: number[];
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
    backgroundColor: props.$isPeak
      ? PEAK_COLOR
      : props.$active || props.$coloredInactive
        ? props.$color
        : INACTIVE_COLOR,
    opacity: props.$isPeak || props.$active ? 1 : props.$coloredInactive ? INACTIVE_OPACITY : 1,
    boxShadow:
      props.$active || props.$isPeak
        ? `0 0 4px ${props.$isPeak ? PEAK_COLOR : props.$color}40`
        : 'none',
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
  levels,
  peakLevels,
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
  const labels = channelLabels ?? getDefaultLabels(levels.length);
  const resolvedLabelColor = labelColor ?? DEFAULT_LABEL_COLOR;

  const channelCount = levels.length;

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

  const renderChannel = (channelIndex: number) => {
    const level = levels[channelIndex];
    const levelDb = normalizedToDb(level);
    const peakDb = peakLevels != null ? normalizedToDb(peakLevels[channelIndex]) : null;

    // Find closest threshold index for peak (in render order)
    let peakSegmentIndex = -1;
    if (peakDb != null) {
      let minDist = Infinity;
      for (let i = 0; i < renderThresholds.length; i++) {
        const dist = Math.abs(renderThresholds[i] - peakDb);
        if (dist < minDist) {
          minDist = dist;
          peakSegmentIndex = i;
        }
      }
    }

    return (
      <ChannelColumn key={channelIndex} $orientation={orientation} data-channel>
        {orientation === 'horizontal' && (
          <ChannelLabel $labelColor={resolvedLabelColor}>{labels[channelIndex]}</ChannelLabel>
        )}
        <SegmentStack $orientation={orientation}>
          {renderThresholds.map((threshold, segIdx) => {
            const active = levelDb >= threshold;
            const isPeak = segIdx === peakSegmentIndex;
            const color = getColorForDb(threshold, colorStops);

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
                {...(isPeak ? { 'data-peak': true } : {})}
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
