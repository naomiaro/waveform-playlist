import styled from 'styled-components';

/**
 * BaseButton - A styled button component that uses theme values
 *
 * This provides consistent styling across all button elements in the waveform playlist.
 */
export const BaseButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-family: ${(props) => props.theme.fontFamily};
  font-size: ${(props) => props.theme.fontSize};
  font-weight: 500;
  color: ${(props) => props.theme.buttonText};
  background-color: ${(props) => props.theme.buttonBackground};
  border: 1px solid ${(props) => props.theme.buttonBorder};
  border-radius: ${(props) => props.theme.borderRadius};
  cursor: pointer;
  outline: none;
  transition:
    background-color 0.15s ease-in-out,
    border-color 0.15s ease-in-out,
    box-shadow 0.15s ease-in-out;

  &:hover:not(:disabled) {
    background-color: ${(props) => props.theme.buttonHoverBackground};
  }

  &:focus {
    box-shadow: 0 0 0 2px ${(props) => props.theme.inputFocusBorder}33;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
