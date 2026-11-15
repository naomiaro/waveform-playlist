/**
 * Loading Badge
 *
 * The example pages' loading text, drawn as a small badge over a corner of
 * the editor (or of a box the page chooses, see `placement`). It takes no
 * layout space, so its appearing and
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
 * Where the badge sits in its frame.
 * - `editor` (default): the frame wraps the editor. Below the default 30 px
 *   timescale and the 22 px clip header of the first track, so the badge
 *   covers neither: it sits over the first track's waveform.
 * - `frame-bottom`: the frame wraps a block that ends with the editor and may
 *   be empty (an editor that is not mounted yet). Over the last track, above
 *   the editor's horizontal scrollbar.
 * - `box-corner`: the top-right corner of a padded box (16 px padding).
 */
export type LoadingBadgePlacement = 'editor' | 'frame-bottom' | 'box-corner';

const PLACEMENTS: Record<LoadingBadgePlacement, React.CSSProperties> = {
  editor: { top: '60px', right: '8px' },
  'frame-bottom': { bottom: '24px', right: '8px' },
  'box-corner': { top: '10px', right: '12px' },
};

/** Above the waveform, playhead and selection layers of the editor. */
const BADGE_Z_INDEX = 110;

export const LoadingBadgeFrame = styled.div`
  position: relative;
`;

const Region = styled.div`
  position: absolute;
  z-index: ${BADGE_Z_INDEX};
  pointer-events: none;
`;

const Badge = styled.span`
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border: 1px solid var(--ifm-color-emphasis-300, #dadde1);
  border-radius: 0.25rem;
  background: var(--ifm-background-surface-color, #ffffff);
  color: var(--ifm-color-emphasis-800, #444950);
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

interface LoadingBadgeProps {
  /** Whether something is loading: the badge is drawn only then. */
  active: boolean;
  /** Where in its frame the badge sits. Default `editor`. */
  placement?: LoadingBadgePlacement;
  children: React.ReactNode;
}

/**
 * Render it unconditionally, outside any condition that mounts the editor,
 * so the status region exists before its text does.
 */
export const LoadingBadge: React.FC<LoadingBadgeProps> = ({
  active,
  placement = 'editor',
  children,
}) => (
  <Region role="status" style={PLACEMENTS[placement]}>
    {active ? <Badge>{children}</Badge> : null}
  </Region>
);
