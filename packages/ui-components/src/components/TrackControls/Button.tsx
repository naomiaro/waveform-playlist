import styled from 'styled-components';

/**
 * TrackControls Button - Small button for track controls (Mute, Solo, etc.)
 *
 * Supports variants: outline (default), danger, info
 * Uses theme values for consistent styling.
 */
export const Button = styled.button.attrs({
  type: 'button',
})<{ $variant?: 'outline' | 'danger' | 'info' }>`
  display: inline-block;
  font-family: ${(props) => props.theme.fontFamily};
  font-weight: 500;
  text-align: center;
  vertical-align: middle;
  user-select: none;
  padding: 0.25rem 0.4rem;
  font-size: ${(props) => props.theme.fontSizeSmall};
  line-height: 1;
  border-radius: ${(props) => props.theme.borderRadius};
  transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out,
    border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
  cursor: pointer;

  ${(props) => {
    if (props.$variant === 'danger') {
      return `
        color: #fff;
        background-color: #dc3545;
        border: 1px solid #dc3545;

        &:hover {
          background-color: #c82333;
          border-color: #bd2130;
        }

        &:focus {
          outline: none;
          box-shadow: 0 0 0 0.2rem rgba(225, 83, 97, 0.5);
        }
      `;
    } else if (props.$variant === 'info') {
      return `
        color: #fff;
        background-color: #17a2b8;
        border: 1px solid #17a2b8;

        &:hover {
          background-color: #138496;
          border-color: #117a8b;
        }

        &:focus {
          outline: none;
          box-shadow: 0 0 0 0.2rem rgba(58, 176, 195, 0.5);
        }
      `;
    } else {
      // outline variant (default) - uses theme colors
      return `
        color: ${props.theme.textColor};
        background-color: transparent;
        border: 1px solid ${props.theme.borderColor};

        &:hover {
          color: #fff;
          background-color: ${props.theme.textColor};
          border-color: ${props.theme.textColor};
        }

        &:focus {
          outline: none;
          box-shadow: 0 0 0 0.2rem ${props.theme.inputFocusBorder}33;
        }
      `;
    }
  }}
`;
