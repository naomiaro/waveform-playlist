import styled from 'styled-components';

/**
 * BaseInput - A styled input component that uses theme values
 *
 * This provides consistent styling across all input elements in the waveform playlist.
 * Styling is controlled via the theme, making it easy to adapt to different environments.
 */
export const BaseInput = styled.input`
  padding: 0.5rem 0.75rem;
  font-family: ${(props) => props.theme.fontFamily};
  font-size: ${(props) => props.theme.fontSize};
  color: ${(props) => props.theme.inputText};
  background-color: ${(props) => props.theme.inputBackground};
  border: 1px solid ${(props) => props.theme.inputBorder};
  border-radius: ${(props) => props.theme.borderRadius};
  outline: none;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;

  &::placeholder {
    color: ${(props) => props.theme.inputPlaceholder};
  }

  &:focus {
    border-color: ${(props) => props.theme.inputFocusBorder};
    box-shadow: 0 0 0 2px ${(props) => props.theme.inputFocusBorder}33;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

/**
 * BaseInputSmall - A smaller variant for compact layouts
 */
export const BaseInputSmall = styled(BaseInput)`
  padding: 0.25rem 0.5rem;
  font-size: ${(props) => props.theme.fontSizeSmall};
`;
