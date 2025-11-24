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

/**
 * ControlButton - A colored action button (primary/success/info variants)
 *
 * This is used for prominent actions like Play, Pause, Record.
 * For neutral buttons, use BaseButton from the styled primitives.
 */
export const BaseControlButton = styled.button<ControlButtonProps>`
  padding: 0.5rem 1rem;
  background: ${(props) => buttonColors[props.variant || 'primary'].background};
  color: white;
  border: none;
  border-radius: ${(props) => props.theme.borderRadius};
  cursor: pointer;
  font-family: ${(props) => props.theme.fontFamily};
  font-size: ${(props) => props.theme.fontSize};
  font-weight: ${(props) => (props.variant === 'info' ? '600' : '500')};
  transition: background-color 0.15s ease-in-out;

  &:hover:not(:disabled) {
    background: ${(props) => buttonColors[props.variant || 'primary'].hover};
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${(props) => buttonColors[props.variant || 'primary'].background}66;
  }

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
    opacity: 0.6;
  }
`;
