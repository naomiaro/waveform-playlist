import styled from 'styled-components';

export const Header = styled.header`
  overflow: hidden;
  height: 26px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.2rem;
  font-size: ${(props) => props.theme.fontSizeSmall};
  color: ${(props) => props.theme.textColor};
  background-color: transparent;
`;
