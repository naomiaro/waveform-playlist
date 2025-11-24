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
  const { waveHeight } = usePlaylistInfo();
  const devicePixelRatio = useDevicePixelRatio();

  // Use selected outline color if track is selected
  const waveOutlineColor = isSelected && theme
    ? theme.selectedWaveOutlineColor
    : theme?.waveOutlineColor;

  return (
    <Channel
      {...props}
      {...theme}
      waveOutlineColor={waveOutlineColor}
      waveHeight={waveHeight}
      devicePixelRatio={devicePixelRatio}
    ></Channel>
  );
};
