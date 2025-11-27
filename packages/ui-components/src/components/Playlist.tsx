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

// Use .attrs() for width to avoid generating new CSS classes on every render
const ScrollContainer = styled.div.attrs<ScrollContainerProps>((props) => ({
  style: props.$width !== undefined ? { width: `${props.$width}px` } : {},
}))<ScrollContainerProps>`
  position: relative;
  background: ${(props) => props.$backgroundColor || 'transparent'};
`;

interface TimescaleWrapperProps {
  readonly $width?: number;
  readonly $backgroundColor?: string;
}

// Use .attrs() for width to avoid generating new CSS classes on every render
const TimescaleWrapper = styled.div.attrs<TimescaleWrapperProps>((props) => ({
  style: props.$width ? { minWidth: `${props.$width}px` } : {},
}))<TimescaleWrapperProps>`
  background: ${(props) => props.$backgroundColor || 'white'};
  width: 100%;
  overflow: visible;
`;

interface TracksContainerProps {
  readonly $width?: number;
  readonly $backgroundColor?: string;
}

// Use .attrs() for width to avoid generating new CSS classes on every render
const TracksContainer = styled.div.attrs<TracksContainerProps>((props) => ({
  style: props.$width !== undefined ? { minWidth: `${props.$width}px` } : {},
}))<TracksContainerProps>`
  position: relative;
  background: ${(props) => props.$backgroundColor || 'transparent'};
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
  z-index: 1; /* Low z-index - clip headers and boundaries have higher z-index */
`;

export interface PlaylistProps {
  readonly theme: DefaultTheme;
  readonly children?: JSX.Element | JSX.Element[];
  readonly backgroundColor?: string;
  readonly timescaleBackgroundColor?: string;
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
  timescaleBackgroundColor,
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
        {timescale && <TimescaleWrapper $width={timescaleWidth} $backgroundColor={timescaleBackgroundColor}>{timescale}</TimescaleWrapper>}
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
