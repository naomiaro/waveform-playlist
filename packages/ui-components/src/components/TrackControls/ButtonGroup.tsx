import styled from 'styled-components';

export const ButtonGroup = styled.div`
  margin-bottom: 0.3rem;

  button:not(:first-child) {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  button:not(:last-child) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
`;
