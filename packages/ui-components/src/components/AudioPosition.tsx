import React from 'react';
import styled from 'styled-components';

const PositionDisplay = styled.span`
  font-family: monospace;
  font-size: 1rem;
  padding: 0.375rem 0.75rem;
  background: #f8f9fa;
  border: 1px solid #ced4da;
  border-radius: 0.25rem;
  min-width: 120px;
  text-align: center;
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
