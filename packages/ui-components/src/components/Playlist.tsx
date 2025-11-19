import styled, { DefaultTheme, withTheme } from 'styled-components';
import React, { FunctionComponent } from 'react';

const Wrapper = styled.div`
  overflow-y: hidden;
  overflow-x: visible;
  position: relative;
`;

interface ScrollContainerProps {
  readonly $backgroundColor?: string;
  readonly $width?: number;
}

const ScrollContainer = styled.div<ScrollContainerProps>`
  overflow-y: auto;
  overflow-x: auto;
  position: relative;
  background: ${(props) => props.$backgroundColor || 'transparent'};
  ${(props) => props.$width !== undefined && `width: ${props.$width}px;`}
`;

interface TimescaleWrapperProps {
  readonly $width?: number;
}

const TimescaleWrapper = styled.div<TimescaleWrapperProps>`
  background: white;
  ${(props) => props.$width && `min-width: ${props.$width}px;`}
  overflow: visible;
`;

const TracksContainer = styled.div`
  position: relative;
`;

const ClickOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  cursor: crosshair;
  z-index: 100;
`;

export interface PlaylistProps {
  readonly theme: DefaultTheme;
  readonly children?: JSX.Element | JSX.Element[];
  readonly backgroundColor?: string;
  readonly timescale?: JSX.Element;
  readonly timescaleWidth?: number;
  readonly scrollContainerWidth?: number;
  readonly onTracksClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  readonly onTracksMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  readonly onTracksMouseMove?: (e: React.MouseEvent<HTMLDivElement>) => void;
  readonly onTracksMouseUp?: (e: React.MouseEvent<HTMLDivElement>) => void;
  readonly scrollContainerRef?: (el: HTMLDivElement | null) => void;
}
export const Playlist: FunctionComponent<PlaylistProps> = ({
  children,
  backgroundColor,
  timescale,
  timescaleWidth,
  scrollContainerWidth,
  onTracksClick,
  onTracksMouseDown,
  onTracksMouseMove,
  onTracksMouseUp,
  scrollContainerRef
}) => {
  return (
    <Wrapper>
      <ScrollContainer
        data-scroll-container="true"
        $backgroundColor={backgroundColor}
        $width={scrollContainerWidth}
        ref={scrollContainerRef}
      >
        {timescale && <TimescaleWrapper $width={timescaleWidth}>{timescale}</TimescaleWrapper>}
        <TracksContainer>
          {children}
          {(onTracksClick || onTracksMouseDown) && (
            <ClickOverlay
              onClick={onTracksClick}
              onMouseDown={onTracksMouseDown}
              onMouseMove={onTracksMouseMove}
              onMouseUp={onTracksMouseUp}
            />
          )}
        </TracksContainer>
      </ScrollContainer>
    </Wrapper>
  );
};

export const StyledPlaylist = withTheme(Playlist);
