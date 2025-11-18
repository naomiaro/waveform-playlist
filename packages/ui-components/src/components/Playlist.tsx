import styled, { DefaultTheme, withTheme } from 'styled-components';
import React, { FunctionComponent } from 'react';

const Wrapper = styled.div`
  overflow: hidden;
  position: relative;
`;

const ScrollContainer = styled.div`
  overflow: auto;
  position: relative;
`;

export interface PlaylistProps {
  readonly theme: DefaultTheme;
  readonly children?: JSX.Element | JSX.Element[];
}
export const Playlist: FunctionComponent<PlaylistProps> = ({ children }) => {
  return (
    <Wrapper>
      <ScrollContainer data-scroll-container="true">{children}</ScrollContainer>
    </Wrapper>
  );
};

export const StyledPlaylist = withTheme(Playlist);
