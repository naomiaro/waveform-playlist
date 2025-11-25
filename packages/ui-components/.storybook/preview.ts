import type { Preview } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider } from 'styled-components';
import { defaultTheme, darkTheme } from '../src/wfpl-theme';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      options: {
        light: { name: 'light', value: '#ffffff' },
        dark: { name: 'dark', value: '#1e1e1e' }
      }
    },
  },

  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light Theme' },
          { value: 'dark', title: 'Dark Theme' },
        ],
        dynamicTitle: true,
      },
    },
  },

  decorators: [
    (Story, context) => {
      const theme = context.globals.theme === 'dark' ? darkTheme : defaultTheme;
      const backgroundColor = context.globals.theme === 'dark' ? '#1e1e1e' : '#ffffff';

      return React.createElement(
        ThemeProvider,
        { theme },
        React.createElement(
          'div',
          { style: { backgroundColor, padding: '1rem', minHeight: '100vh' } },
          React.createElement(Story)
        )
      );
    },
  ],

  initialGlobals: {
    theme: 'light',
    backgrounds: {
      value: 'light'
    }
  }
};

export default preview;