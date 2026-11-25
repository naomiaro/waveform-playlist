import React from 'react';
import styled from 'styled-components';
import { XIcon } from '@phosphor-icons/react/dist/csr/X';

const StyledCloseButton = styled.button`
  position: absolute;
  left: 0;
  top: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 16px;
  padding: 2px 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition:
    opacity 0.15s,
    color 0.15s;

  &:hover {
    opacity: 1;
    color: #dc3545;
  }
`;

export interface CloseButtonProps {
  onClick: (e: React.MouseEvent) => void;
  title?: string;
}

export const CloseButton: React.FC<CloseButtonProps> = ({ onClick, title = 'Remove track' }) => (
  <StyledCloseButton onClick={onClick} title={title}>
    <XIcon size={12} weight="bold" />
  </StyledCloseButton>
);
