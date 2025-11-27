import styled from 'styled-components';

export interface ControlButtonProps {
  variant?: 'primary' | 'success' | 'info';
}

/**
 * ControlButton - A colored action button (primary/success/info variants)
 *
 * This is used for prominent actions like Play, Pause, Record.
 * For neutral buttons, use BaseButton from the styled primitives.
 *
 * Uses theme colors when available, with fallbacks for standalone use.
 */
export const BaseControlButton = styled.button<ControlButtonProps>`
  padding: 0.5rem 1rem;
  background: ${(props) => props.theme.buttonBackground || '#007bff'};
  color: ${(props) => props.theme.buttonText || 'white'};
  border: none;
  border-radius: ${(props) => props.theme.borderRadius};
  cursor: pointer;
  font-family: ${(props) => props.theme.fontFamily};
  font-size: ${(props) => props.theme.fontSize};
  font-weight: 500;
  transition: background-color 0.15s ease-in-out;

  &:hover:not(:disabled) {
    background: ${(props) => props.theme.buttonHoverBackground || '#0056b3'};
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${(props) => props.theme.buttonBackground || '#007bff'}66;
  }

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
    opacity: 0.6;
  }
`;
