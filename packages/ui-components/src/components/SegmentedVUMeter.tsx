import React, { useMemo } from 'react';
import styled from 'styled-components';
import { normalizedToDb } from '@waveform-playlist/core';

interface ColorStop {
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
  className?: string;
}

const DEFAULT_COLOR_STOPS: ColorStop[] = [
  { dB: 2, color: '#e74c3c' },
  { dB: 0, color: '#e67e22' },
  { dB: -2, color: '#f1c40f' },
  { dB: -5, color: '#2ecc71' },
  { dB: -8, color: '#27ae60' },
  { dB: -15, color: '#5dade2' },
  { dB: -50, color: '#85c1e9' },
];

const INACTIVE_COLOR = 'rgba(255, 255, 255, 0.06)';
const PEAK_COLOR = '#ffffff';

function getDefaultLabels(channelCount: number): string[] {
  if (channelCount === 1) return ['M'];
  if (channelCount === 2) return ['L', 'R'];
  return Array.from({ length: channelCount }, (_, i) => String(i + 1));
}

function getColorForDb(dB: number, colorStops: ColorStop[]): string {
  for (const stop of colorStops) {
    if (dB >= stop.dB) {
      return stop.color;
    }
  }
  return colorStops[colorStops.length - 1].color;
}

function computeThresholds(segmentCount: number, dBRange: [number, number]): number[] {
  const [minDb, maxDb] = dBRange;
  const step = (maxDb - minDb) / (segmentCount - 1);
  return Array.from({ length: segmentCount }, (_, i) => maxDb - i * step);
}

function selectScaleLabels(
  thresholds: number[],
  targetCount: number
): { index: number; label: string }[] {
  if (thresholds.length <= targetCount) {
    return thresholds.map((t, i) => ({
      index: i,
      label: formatDbLabel(t),
    }));
  }
  const step = (thresholds.length - 1) / (targetCount - 1);
  const labels: { index: number; label: string }[] = [];
  for (let i = 0; i < targetCount; i++) {
    const idx = Math.round(i * step);
    labels.push({ index: idx, label: formatDbLabel(thresholds[idx]) });
  }
  return labels;
}

function formatDbLabel(dB: number): string {
  return Math.round(dB).toString();
}

// --- Styled Components ---

const MeterContainer = styled.div`
  display: inline-flex;
  background: #1a1a2e;
  padding: 12px;
  border-radius: 6px;
  gap: 4px;
  font-family: 'Courier New', monospace;
`;

const ChannelColumn = styled.div`
  display: flex;
  flex-direction: column;
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
}

const Segment = styled.div.attrs<SegmentStyleProps>((props) => ({
  style: {
    width: `${props.$width}px`,
    height: `${props.$height}px`,
    marginBottom: `${props.$gap}px`,
    backgroundColor: props.$isPeak ? PEAK_COLOR : props.$active ? props.$color : INACTIVE_COLOR,
    boxShadow:
      props.$active || props.$isPeak
        ? `0 0 4px ${props.$isPeak ? PEAK_COLOR : props.$color}40`
        : 'none',
  },
}))<SegmentStyleProps>`
  border-radius: 1px;
`;

const ChannelLabel = styled.div`
  color: #aaa;
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

const ScaleLabel = styled.div.attrs<ScaleLabelStyleProps>((props) => ({
  style: {
    top: `${props.$top}px`,
  },
}))<ScaleLabelStyleProps>`
  position: absolute;
  left: 50%;
  color: #888;
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
  className,
}) => {
  const labels = channelLabels ?? getDefaultLabels(levels.length);

  const thresholds = useMemo(
    () => computeThresholds(segmentCount, dBRange),
    [segmentCount, dBRange]
  );

  const scaleLabels = useMemo(() => selectScaleLabels(thresholds, 12), [thresholds]);

  const channelCount = levels.length;
  const isMultiChannel = channelCount >= 2;
  const segmentTotalHeight = segmentHeight + segmentGap;

  const renderChannel = (channelIndex: number) => {
    const level = levels[channelIndex];
    const levelDb = normalizedToDb(level);
    const peakDb = peakLevels != null ? normalizedToDb(peakLevels[channelIndex]) : null;

    // Find closest threshold index for peak
    let peakSegmentIndex = -1;
    if (peakDb != null) {
      let minDist = Infinity;
      for (let i = 0; i < thresholds.length; i++) {
        const dist = Math.abs(thresholds[i] - peakDb);
        if (dist < minDist) {
          minDist = dist;
          peakSegmentIndex = i;
        }
      }
    }

    return (
      <ChannelColumn key={channelIndex} data-channel>
        <SegmentStack $orientation={orientation}>
          {thresholds.map((threshold, segIdx) => {
            const active = levelDb >= threshold;
            const isPeak = segIdx === peakSegmentIndex;
            const color = getColorForDb(threshold, colorStops);

            return (
              <Segment
                key={segIdx}
                $width={segmentWidth}
                $height={segmentHeight}
                $gap={segmentGap}
                $active={active}
                $color={color}
                $isPeak={isPeak}
                data-segment
                {...(isPeak ? { 'data-peak': true } : {})}
              />
            );
          })}
        </SegmentStack>
        <ChannelLabel>{labels[channelIndex]}</ChannelLabel>
      </ChannelColumn>
    );
  };

  const renderScale = () => {
    const totalHeight = segmentCount * segmentTotalHeight - segmentGap;
    return (
      <ScaleColumn style={{ height: `${totalHeight}px` }}>
        {scaleLabels.map(({ index, label }) => {
          const top = index * segmentTotalHeight + segmentHeight / 2;
          return (
            <ScaleLabel key={index} $top={top}>
              {label}
            </ScaleLabel>
          );
        })}
      </ScaleColumn>
    );
  };

  if (isMultiChannel) {
    // For multi-channel: channels on sides, scale in middle
    const midpoint = Math.ceil(channelCount / 2);
    const leftChannels = Array.from({ length: midpoint }, (_, i) => i);
    const rightChannels = Array.from({ length: channelCount - midpoint }, (_, i) => midpoint + i);

    return (
      <MeterContainer className={className} data-meter-orientation={orientation}>
        {leftChannels.map(renderChannel)}
        {showScale && renderScale()}
        {rightChannels.map(renderChannel)}
      </MeterContainer>
    );
  }

  // Single channel: channel on left, scale on right
  return (
    <MeterContainer className={className} data-meter-orientation={orientation}>
      {renderChannel(0)}
      {showScale && renderScale()}
    </MeterContainer>
  );
};

export const SegmentedVUMeter = React.memo(SegmentedVUMeterInner);
