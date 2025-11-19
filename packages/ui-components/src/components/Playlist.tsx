import styled, { DefaultTheme, withTheme } from 'styled-components';
import React, { FunctionComponent } from 'react';

const Wrapper = styled.div`
  overflow: hidden;
  position: relative;
`;

interface ScrollContainerProps {
  readonly $backgroundColor?: string;
}

const ScrollContainer = styled.div<ScrollContainerProps>`
  overflow: auto;
  position: relative;
  background: ${(props) => props.$backgroundColor || 'transparent'};
`;

interface TimescaleWrapperProps {
  readonly $width?: number;
}

const TimescaleWrapper = styled.div<TimescaleWrapperProps>`
  background: white;
  ${(props) => props.$width && `min-width: ${props.$width}px;`}
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
