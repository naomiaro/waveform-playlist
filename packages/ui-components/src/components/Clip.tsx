import React, { FunctionComponent, ReactNode } from 'react';
import styled from 'styled-components';

interface ClipContainerProps {
  readonly $left: number; // Horizontal position in pixels
  readonly $width: number; // Width in pixels
}

const ClipContainer = styled.div.attrs<ClipContainerProps>((props) => ({
  style: {
    left: `${props.$left}px`,
    width: `${props.$width}px`,
  },
}))<ClipContainerProps>`
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
`;

export interface ClipProps {
  className?: string;
  children?: ReactNode;
  startTime: number; // Start time in seconds
  duration: number; // Duration in seconds
  sampleRate: number;
  samplesPerPixel: number;
}

/**
 * Clip component for rendering individual audio clips within a track
 *
 * Each clip is positioned based on its startTime and has a width based on its duration.
 * This allows multiple clips to be arranged on a single track with gaps or overlaps.
 */
export const Clip: FunctionComponent<ClipProps> = ({
  children,
  className,
  startTime,
  duration,
  sampleRate,
  samplesPerPixel,
}) => {
  // Calculate horizontal position based on start time
  const left = Math.floor((startTime * sampleRate) / samplesPerPixel);

  // Calculate width based on duration
  const width = Math.floor((duration * sampleRate) / samplesPerPixel);

  return (
    <ClipContainer
      className={className}
      $left={left}
      $width={width}
    >
      {children}
    </ClipContainer>
  );
};
