import React, { FunctionComponent } from 'react';
import { useDevicePixelRatio, usePlaylistInfo, useTheme } from '../contexts';
import { Channel } from './Channel';

export interface SmartChannelProps {
  className?: string;
  index: number;
  data: Int8Array | Int16Array;
  bits: 8 | 16;
  length: number;
  isSelected?: boolean; // Whether this channel's track is selected
  /** If true, background is transparent (for use with external progress overlay) */
  transparentBackground?: boolean;
}

export const SmartChannel: FunctionComponent<SmartChannelProps> = ({ isSelected, transparentBackground, ...props }) => {
  const theme = useTheme();
  const { waveHeight, barWidth, barGap } = usePlaylistInfo();
  const devicePixelRatio = useDevicePixelRatio();

  // Use selected colors if track is selected
  const waveOutlineColor = isSelected && theme
    ? theme.selectedWaveOutlineColor
    : theme?.waveOutlineColor;

  const waveFillColor = isSelected && theme
    ? theme.selectedWaveFillColor
    : theme?.waveFillColor;

  // Get draw mode from theme (defaults to 'inverted' for backwards compatibility)
  const drawMode = theme?.waveformDrawMode || 'inverted';

  return (
    <Channel
      {...props}
      {...theme}
      waveOutlineColor={waveOutlineColor}
      waveFillColor={waveFillColor}
      waveHeight={waveHeight}
      devicePixelRatio={devicePixelRatio}
      barWidth={barWidth}
      barGap={barGap}
      transparentBackground={transparentBackground}
      drawMode={drawMode}
    ></Channel>
  );
};
