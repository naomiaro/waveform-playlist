import styled from 'styled-components';

/**
 * BaseLabel - A styled label component that uses theme values
 */
export const BaseLabel = styled.label`
  font-family: ${(props) => props.theme.fontFamily};
  font-size: ${(props) => props.theme.fontSizeSmall};
  font-weight: 500;
  color: ${(props) => props.theme.textColorMuted};
  margin-bottom: 0.25rem;
  display: block;
`;

/**
 * InlineLabel - A label that displays inline with its input
 */
export const InlineLabel = styled.label`
  font-family: ${(props) => props.theme.fontFamily};
  font-size: ${(props) => props.theme.fontSize};
  color: ${(props) => props.theme.textColor};
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
`;

/**
 * ScreenReaderOnly - Visually hidden but accessible to screen readers
 */
export const ScreenReaderOnly = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;
