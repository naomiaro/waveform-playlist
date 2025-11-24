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
}

export const SmartChannel: FunctionComponent<SmartChannelProps> = (props) => {
  const theme = useTheme();
  const { waveHeight } = usePlaylistInfo();
  const devicePixelRatio = useDevicePixelRatio();

  return (
    <Channel
      {...props}
      {...theme}
      waveHeight={waveHeight}
      devicePixelRatio={devicePixelRatio}
    ></Channel>
  );
};
