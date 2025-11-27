/**
 * VU Meter Component
 *
 * Displays real-time audio input levels with color-coded zones
 * and peak indicator.
 */

import React from 'react';
import styled from 'styled-components';

export interface VUMeterProps {
  /**
   * Current audio level (0-1)
   */
  level: number;

  /**
   * Peak level (0-1)
   * Optional - if provided, shows peak indicator
   */
  peakLevel?: number;

  /**
   * Width of the meter in pixels
   * Default: 200
   */
  width?: number;

  /**
   * Height of the meter in pixels
   * Default: 20
   */
  height?: number;

  /**
   * Additional CSS class name
   */
  className?: string;
}

const MeterContainer = styled.div<{ $width: number; $height: number }>`
  position: relative;
  width: ${props => props.$width}px;
  height: ${props => props.$height}px;
  background: #2c3e50;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
`;

// Helper to get gradient color based on level
const getLevelGradient = (level: number): string => {
  if (level < 0.6) return 'linear-gradient(90deg, #27ae60, #2ecc71)';
  if (level < 0.85) return 'linear-gradient(90deg, #f39c12, #f1c40f)';
  return 'linear-gradient(90deg, #c0392b, #e74c3c)';
};

// Use .attrs() for frequently changing styles to avoid generating new CSS classes
const MeterFill = styled.div.attrs<{ $level: number; $height: number }>(props => ({
  style: {
    width: `${props.$level * 100}%`,
    height: `${props.$height}px`,
    background: getLevelGradient(props.$level),
    boxShadow: props.$level > 0.01 ? '0 0 8px rgba(255, 255, 255, 0.3)' : 'none',
  },
}))<{ $level: number; $height: number }>`
  position: absolute;
  left: 0;
  top: 0;
  transition: width 0.05s ease-out, background 0.1s ease-out;
`;

// Use .attrs() for frequently changing left position
const PeakIndicator = styled.div.attrs<{ $peakLevel: number; $height: number }>(props => ({
  style: {
    left: `${props.$peakLevel * 100}%`,
    height: `${props.$height}px`,
  },
}))<{ $peakLevel: number; $height: number }>`
  position: absolute;
  top: 0;
  width: 2px;
  background: #ecf0f1;
  box-shadow: 0 0 4px rgba(236, 240, 241, 0.8);
  transition: left 0.1s ease-out;
`;

const ScaleMarkers = styled.div<{ $height: number }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: ${props => props.$height}px;
  pointer-events: none;
`;

const ScaleMark = styled.div<{ $position: number; $height: number }>`
  position: absolute;
  left: ${props => props.$position}%;
  top: 0;
  width: 1px;
  height: ${props => props.$height}px;
  background: rgba(255, 255, 255, 0.2);
`;

/**
 * VU Meter component for displaying audio input levels
 *
 * @example
 * ```typescript
 * import { useMicrophoneLevel, VUMeter } from '@waveform-playlist/recording';
 *
 * const { level, peakLevel } = useMicrophoneLevel(stream);
 *
 * return <VUMeter level={level} peakLevel={peakLevel} width={300} height={24} />;
 * ```
 */
const VUMeterComponent: React.FC<VUMeterProps> = ({
  level,
  peakLevel,
  width = 200,
  height = 20,
  className,
}) => {
  // Clamp values to 0-1 range
  const clampedLevel = Math.max(0, Math.min(1, level));
  const clampedPeak = peakLevel !== undefined
    ? Math.max(0, Math.min(1, peakLevel))
    : 0;

  return (
    <MeterContainer $width={width} $height={height} className={className}>
      <MeterFill $level={clampedLevel} $height={height} />

      {peakLevel !== undefined && clampedPeak > 0 && (
        <PeakIndicator $peakLevel={clampedPeak} $height={height} />
      )}

      <ScaleMarkers $height={height}>
        <ScaleMark $position={60} $height={height} />
        <ScaleMark $position={85} $height={height} />
      </ScaleMarkers>
    </MeterContainer>
  );
};

// Memoize to prevent unnecessary re-renders when parent updates
export const VUMeter = React.memo(VUMeterComponent);
