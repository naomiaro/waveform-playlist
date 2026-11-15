/**
 * Loading Text
 *
 * A loading indicator that keeps its place in the layout while nothing is
 * loading, so that its appearing and disappearing moves nothing on the page.
 * A layout change that moves the editor during a clip drag leaves the dragged
 * clip behind until the release, so the example pages reserve this space.
 *
 * The box is always as wide and as tall as `widest`, an invisible copy kept in
 * the same grid cell. The visible text sits in a status region and is
 * rendered only while `active`, so a screen reader announces it when it
 * appears and when it changes.
 */

import React from 'react';
import styled from 'styled-components';

const Box = styled.span`
  display: inline-grid;
  font-variant-numeric: tabular-nums;

  & > * {
    grid-area: 1 / 1;
  }
`;

const Reserve = styled.span`
  visibility: hidden;
`;

/** The style of the loading text in the example toolbars. */
const MUTED_STYLE: React.CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--ifm-color-emphasis-600)',
};

interface LoadingTextProps {
  /** Whether something is loading: the text is shown only then. */
  active: boolean;
  /** The widest text this indicator shows, e.g. `Loading: 12/12`. Its box is reserved. */
  widest: string;
  /** Text style. Default: the muted toolbar style. Pass `{}` to inherit. */
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export const LoadingText: React.FC<LoadingTextProps> = ({
  active,
  widest,
  style = MUTED_STYLE,
  children,
}) => (
  <Box style={style}>
    <Reserve aria-hidden="true">{widest}</Reserve>
    <span role="status">{active ? children : null}</span>
  </Box>
);
