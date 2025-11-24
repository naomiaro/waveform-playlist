import styled from 'styled-components';

/**
 * BaseCheckboxWrapper - Container for checkbox + label
 */
export const BaseCheckboxWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`;

/**
 * BaseCheckbox - A styled checkbox input
 */
export const BaseCheckbox = styled.input`
  cursor: pointer;
  accent-color: ${(props) => props.theme.inputFocusBorder};

  &:disabled {
    cursor: not-allowed;
  }
`;

/**
 * BaseCheckboxLabel - Label for checkboxes
 */
export const BaseCheckboxLabel = styled.label`
  margin: 0;
  cursor: pointer;
  user-select: none;
  font-family: ${(props) => props.theme.fontFamily};
  font-size: ${(props) => props.theme.fontSize};
  color: ${(props) => props.theme.textColor};
`;
