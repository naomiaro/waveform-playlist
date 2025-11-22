import React, { FunctionComponent, ReactNode } from 'react';
import styled from 'styled-components';
import { ClipHeader } from './ClipHeader';

export const CLIP_HEADER_HEIGHT = 22; // Height of the clip header in pixels

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
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.1);
`;

const ChannelsWrapper = styled.div`
  flex: 1;
  position: relative;
  overflow: hidden;
`;

export interface ClipProps {
  className?: string;
  children?: ReactNode;
  clipId: string; // Unique clip ID
  trackIndex: number; // Track index (for drag operations)
  clipIndex: number; // Clip index within track (for drag operations)
  trackName: string; // Track name (shown in header)
  startTime: number; // Start time in seconds
  duration: number; // Duration in seconds
  sampleRate: number;
  samplesPerPixel: number;
  // Optional header (for multi-clip editing with drag-to-move)
  showHeader?: boolean;
  // Theme props for header
  clipHeaderBackgroundColor?: string;
  clipHeaderBorderColor?: string;
  clipHeaderTextColor?: string;
}

/**
 * Clip component for rendering individual audio clips within a track
 *
 * Each clip is positioned based on its startTime and has a width based on its duration.
 * This allows multiple clips to be arranged on a single track with gaps or overlaps.
 *
 * Includes a draggable ClipHeader at the top for repositioning clips on the timeline.
 */
export const Clip: FunctionComponent<ClipProps> = ({
  children,
  className,
  clipId,
  trackIndex,
  clipIndex,
  trackName,
  startTime,
  duration,
  sampleRate,
  samplesPerPixel,
  showHeader = false,
  clipHeaderBackgroundColor,
  clipHeaderBorderColor,
  clipHeaderTextColor,
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
      {showHeader && (
        <ClipHeader
          clipId={clipId}
          trackIndex={trackIndex}
          clipIndex={clipIndex}
          trackName={trackName}
          backgroundColor={clipHeaderBackgroundColor}
          borderColor={clipHeaderBorderColor}
          textColor={clipHeaderTextColor}
        />
      )}
      <ChannelsWrapper>
        {children}
      </ChannelsWrapper>
    </ClipContainer>
  );
};
