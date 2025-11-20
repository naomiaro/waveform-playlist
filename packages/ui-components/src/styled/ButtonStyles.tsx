import styled from 'styled-components';

export interface ControlButtonProps {
  variant?: 'primary' | 'success' | 'info';
}

const buttonColors = {
  primary: {
    background: '#007bff',
    hover: '#0056b3',
  },
  success: {
    background: '#28a745',
    hover: '#218838',
  },
  info: {
    background: '#17a2b8',
    hover: '#138496',
  },
};

export const ControlButton = styled.button<ControlButtonProps>`
  padding: 0.5rem 1rem;
  background: ${(props) => buttonColors[props.variant || 'primary'].background};
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 1rem;
  font-weight: ${(props) => (props.variant === 'info' ? '600' : 'normal')};

  &:hover:not(:disabled) {
    background: ${(props) => buttonColors[props.variant || 'primary'].hover};
  }

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
    opacity: ${(props) => (props.variant === 'info' ? '0.6' : '1')};
  }
`;
