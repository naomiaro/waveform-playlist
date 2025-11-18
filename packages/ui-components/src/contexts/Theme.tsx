import { useContext } from 'react';
import { ThemeContext } from 'styled-components';

export const useTheme = () => useContext(ThemeContext);
