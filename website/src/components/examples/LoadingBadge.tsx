/**
 * Loading Badge
 *
 * The example pages' loading text, drawn as a small badge over the top-right
 * corner of the editor. It takes no layout space, so its appearing and
 * disappearing moves nothing on the page: a layout change that moves the
 * editor during a clip drag leaves the dragged clip behind until the release.
 *
 * Put the editor inside `<LoadingBadgeFrame>` (its positioning parent) and
 * the badge next to it. The status region stays mounted and the badge is
 * rendered into it only while `active`, so a screen reader announces the
 * text when it appears and when it changes. The badge takes no pointer
 * input: a press or a drag under it reaches the waveform.
 */

import React from 'react';
import styled from 'styled-components';

/**
 * Below the default 30 px timescale and the 22 px clip header of the first
 * track, so the badge covers neither: it sits over the first track's waveform.
 */
const TOP_OFFSET = '60px';
const RIGHT_OFFSET = '8px';
/** Above the waveform, playhead and selection layers of the editor. */
const BADGE_Z_INDEX = 110;

export const LoadingBadgeFrame = styled.div`
  position: relative;
`;

const Region = styled.div`
  position: absolute;
  top: ${TOP_OFFSET};
  right: ${RIGHT_OFFSET};
  z-index: ${BADGE_Z_INDEX};
  pointer-events: none;
`;

const Badge = styled.span`
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border: 1px solid var(--ifm-color-emphasis-300);
  border-radius: 0.25rem;
  background: var(--ifm-background-surface-color);
  color: var(--ifm-color-emphasis-700);
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

interface LoadingBadgeProps {
  /** Whether something is loading: the badge is drawn only then. */
  active: boolean;
  children: React.ReactNode;
}

export const LoadingBadge: React.FC<LoadingBadgeProps> = ({ active, children }) => (
  <Region role="status">{active ? <Badge>{children}</Badge> : null}</Region>
);
