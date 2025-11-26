import React, { FunctionComponent } from 'react';
import { useDevicePixelRatio, usePlaylistInfo, useTheme } from '../contexts';
import { Channel } from './Channel';

export interface SmartChannelProps {
  className?: string;
  index: number;
  data: Int8Array | Int16Array;
  bits: 8 | 16;
  length: number;
  progress?: number; // Playback progress (0-1) for showing progress color
  isSelected?: boolean; // Whether this channel's track is selected
}

export const SmartChannel: FunctionComponent<SmartChannelProps> = ({ isSelected, ...props }) => {
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
    ></Channel>
  );
};
