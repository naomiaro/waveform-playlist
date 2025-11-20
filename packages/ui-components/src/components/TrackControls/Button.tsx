import styled from 'styled-components';

export const Button = styled.button.attrs({
  type: 'button',
})<{ $variant?: 'outline' | 'danger' | 'info' }>`
  display: inline-block;
  font-weight: 400;
  text-align: center;
  vertical-align: middle;
  user-select: none;
  padding: 0.25rem 0.4rem;
  font-size: 0.875rem;
  line-height: 0.5;
  border-radius: 0.2rem;
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

        &:active:focus, &:focus {
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

        &:active:focus, &:focus {
          box-shadow: 0 0 0 0.2rem rgba(58, 176, 195, 0.5);
        }
      `;
    } else {
      // outline variant (default)
      return `
        color: #343a40;
        background-color: transparent;
        border: 1px solid #343a40;

        &:hover {
          color: #fff;
          background-color: #343a40;
          border-color: #343a40;
        }

        &:active:focus, &:focus {
          box-shadow: 0 0 0 0.2rem rgba(52, 58, 64, 0.5);
        }
      `;
    }
  }}
`;
