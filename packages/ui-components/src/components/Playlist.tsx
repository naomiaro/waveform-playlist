import styled, { DefaultTheme, withTheme } from 'styled-components';
import React, { FunctionComponent, useRef, useCallback } from 'react';
import { ScrollViewportProvider } from '../contexts/ScrollViewport';

/**
 * Outer wrapper: flex layout separating controls column from scroll area.
 * overflow-y: hidden prevents vertical scrollbar on the wrapper itself.
 */
const Wrapper = styled.div`
  display: flex;
  overflow-y: hidden;
  position: relative;
`;

interface ControlsColumnProps {
  readonly $width: number;
}

const ControlsColumn = styled.div.attrs<ControlsColumnProps>((props) => ({
  style: { width: `${props.$width}px` },
}))<ControlsColumnProps>`
  flex-shrink: 0;
  overflow: hidden;
`;

interface TimescaleGapProps {
  readonly $height: number;
}

const TimescaleGap = styled.div.attrs<TimescaleGapProps>((props) => ({
  style: { height: `${props.$height}px` },
}))<TimescaleGapProps>``;

const ScrollArea = styled.div`
  overflow-x: auto;
  overflow-y: hidden;
  overflow-anchor: none;
  flex: 1;
  position: relative;
`;

interface ScrollContainerInnerProps {
  readonly $backgroundColor?: string;
  readonly $width?: number;
}

// Use .attrs() for width to avoid generating new CSS classes on every render
const ScrollContainerInner = styled.div.attrs<ScrollContainerInnerProps>((props) => ({
  style: props.$width !== undefined ? { width: `${props.$width}px` } : {},
}))<ScrollContainerInnerProps>`
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
  position: relative;
  overflow: hidden; /* Constrain loop region to timescale area */
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
  readonly $isSelecting?: boolean;
}

const ClickOverlay = styled.div<ClickOverlayProps>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  cursor: crosshair;
  /* When selecting, raise z-index above clip boundaries (z-index: 105) to prevent interference */
  z-index: ${(props) => (props.$isSelecting ? 110 : 1)};
`;

export interface PlaylistProps {
  readonly theme: DefaultTheme;
  readonly children?: React.ReactNode;
  readonly backgroundColor?: string;
  readonly timescaleBackgroundColor?: string;
  readonly timescale?: React.ReactElement;
  readonly timescaleWidth?: number;
  readonly tracksWidth?: number;
  readonly controlsWidth?: number;
  readonly onTracksClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  readonly onTracksMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  readonly onTracksMouseMove?: (e: React.MouseEvent<HTMLDivElement>) => void;
  readonly onTracksMouseUp?: (e: React.MouseEvent<HTMLDivElement>) => void;
  readonly scrollContainerRef?: (el: HTMLDivElement | null) => void;
  /** When true, selection is in progress - raises z-index to prevent clip boundary interference */
  readonly isSelecting?: boolean;
  /** Data attribute indicating playlist loading state ('loading' | 'ready') */
  readonly 'data-playlist-state'?: 'loading' | 'ready';
  /** Track control slots rendered in the controls column, one per track */
  readonly trackControlsSlots?: React.ReactNode[];
  /** Height of the timescale gap spacer in the controls column (matches timescale height) */
  readonly timescaleGapHeight?: number;
}
export const Playlist: FunctionComponent<PlaylistProps> = ({
  children,
  backgroundColor,
  timescaleBackgroundColor,
  timescale,
  timescaleWidth,
  tracksWidth,
  controlsWidth,
  onTracksClick,
  onTracksMouseDown,
  onTracksMouseMove,
  onTracksMouseUp,
  scrollContainerRef,
  isSelecting,
  'data-playlist-state': playlistState,
  trackControlsSlots,
  timescaleGapHeight = 0,
}) => {
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  const handleRef = useCallback(
    (el: HTMLDivElement | null) => {
      scrollAreaRef.current = el;
      scrollContainerRef?.(el);
    },
    [scrollContainerRef]
  );

  const showControls = controlsWidth !== undefined && controlsWidth > 0;

  return (
    <Wrapper data-playlist-state={playlistState}>
      {showControls && (
        <ControlsColumn $width={controlsWidth}>
          {timescaleGapHeight > 0 && <TimescaleGap $height={timescaleGapHeight} />}
          {trackControlsSlots}
        </ControlsColumn>
      )}
      <ScrollArea data-scroll-container="true" ref={handleRef}>
        <ScrollViewportProvider containerRef={scrollAreaRef}>
          <ScrollContainerInner $backgroundColor={backgroundColor} $width={tracksWidth}>
            {timescale && (
              <TimescaleWrapper $width={timescaleWidth} $backgroundColor={timescaleBackgroundColor}>
                {timescale}
              </TimescaleWrapper>
            )}
            <TracksContainer $width={tracksWidth} $backgroundColor={backgroundColor}>
              {children}
              {(onTracksClick || onTracksMouseDown) && (
                <ClickOverlay
                  $isSelecting={isSelecting}
                  onClick={onTracksClick}
                  onMouseDown={onTracksMouseDown}
                  onMouseMove={onTracksMouseMove}
                  onMouseUp={onTracksMouseUp}
                />
              )}
            </TracksContainer>
          </ScrollContainerInner>
        </ScrollViewportProvider>
      </ScrollArea>
    </Wrapper>
  );
};

export const StyledPlaylist = withTheme(Playlist);
