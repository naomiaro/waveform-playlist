import styled from 'styled-components';

/**
 * BaseSelect - A styled select component that uses theme values
 *
 * This provides consistent styling across all select elements in the waveform playlist.
 */
export const BaseSelect = styled.select`
  padding: 0.5rem 2rem 0.5rem 0.75rem;
  font-family: ${(props) => props.theme.fontFamily};
  font-size: ${(props) => props.theme.fontSize};
  color: ${(props) => props.theme.inputText};
  background-color: ${(props) => props.theme.inputBackground};
  border: 1px solid ${(props) => props.theme.inputBorder};
  border-radius: ${(props) => props.theme.borderRadius};
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;

  &:focus {
    border-color: ${(props) => props.theme.inputFocusBorder};
    box-shadow: 0 0 0 2px ${(props) => props.theme.inputFocusBorder}33;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Style native option elements for dark mode support */
  option {
    color: ${(props) => props.theme.inputText};
    background-color: ${(props) => props.theme.inputBackground};
  }
`;

/**
 * BaseSelectSmall - A smaller variant for compact layouts
 */
export const BaseSelectSmall = styled(BaseSelect)`
  padding: 0.25rem 1.75rem 0.25rem 0.5rem;
  font-size: ${(props) => props.theme.fontSizeSmall};
`;
