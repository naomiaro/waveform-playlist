import styled, { DefaultTheme, withTheme } from 'styled-components';
import React, { FunctionComponent } from 'react';

const Wrapper = styled.div`
  overflow-y: hidden;
  overflow-x: auto;
  position: relative;
`;

interface ScrollContainerProps {
  readonly $backgroundColor?: string;
  readonly $width?: number;
}

const ScrollContainer = styled.div<ScrollContainerProps>`
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
  width: 100%;
  overflow: visible;
`;

interface TracksContainerProps {
  readonly $width?: number;
  readonly $backgroundColor?: string;
}

const TracksContainer = styled.div<TracksContainerProps>`
  position: relative;
  background: ${(props) => props.$backgroundColor || 'transparent'};
  ${(props) => props.$width !== undefined && `min-width: ${props.$width}px;`}
  width: 100%;
`;

interface ClickOverlayProps {
  readonly $controlsWidth?: number;
}

const ClickOverlay = styled.div<ClickOverlayProps>`
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
  readonly tracksWidth?: number;
  readonly scrollContainerWidth?: number;
  readonly controlsWidth?: number;
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
  tracksWidth,
  scrollContainerWidth,
  controlsWidth,
  onTracksClick,
  onTracksMouseDown,
  onTracksMouseMove,
  onTracksMouseUp,
  scrollContainerRef
}) => {
  return (
    <Wrapper data-scroll-container="true" ref={scrollContainerRef}>
      <ScrollContainer
        $backgroundColor={backgroundColor}
        $width={scrollContainerWidth}
      >
        {timescale && <TimescaleWrapper $width={timescaleWidth}>{timescale}</TimescaleWrapper>}
        <TracksContainer $width={tracksWidth} $backgroundColor={backgroundColor}>
          {children}
          {(onTracksClick || onTracksMouseDown) && (
            <ClickOverlay
              $controlsWidth={controlsWidth}
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
