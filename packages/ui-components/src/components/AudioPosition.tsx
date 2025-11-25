import React from 'react';
import styled from 'styled-components';

const PositionDisplay = styled.span`
  font-family: 'Courier New', Monaco, monospace;
  font-size: 1rem;
  font-weight: 600;
  color: ${props => props.theme?.textColor || '#333'};
  user-select: none;
`;

export interface AudioPositionProps {
  formattedTime: string;
  className?: string;
}

/**
 * Displays the current audio playback position
 */
export const AudioPosition: React.FC<AudioPositionProps> = ({
  formattedTime,
  className,
}) => {
  return (
    <PositionDisplay className={className} aria-label="Audio position">
      {formattedTime}
    </PositionDisplay>
  );
};
