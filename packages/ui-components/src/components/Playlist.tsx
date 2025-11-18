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

export interface PlaylistProps {
  readonly theme: DefaultTheme;
  readonly children?: JSX.Element | JSX.Element[];
  readonly backgroundColor?: string;
  readonly timescale?: JSX.Element;
  readonly timescaleWidth?: number;
}
export const Playlist: FunctionComponent<PlaylistProps> = ({ children, backgroundColor, timescale, timescaleWidth }) => {
  return (
    <Wrapper>
      <ScrollContainer data-scroll-container="true" $backgroundColor={backgroundColor}>
        {timescale && <TimescaleWrapper $width={timescaleWidth}>{timescale}</TimescaleWrapper>}
        <TracksContainer>
          {children}
        </TracksContainer>
      </ScrollContainer>
    </Wrapper>
  );
};

export const StyledPlaylist = withTheme(Playlist);
