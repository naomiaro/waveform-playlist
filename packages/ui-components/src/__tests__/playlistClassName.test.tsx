// @vitest-environment jsdom
//
// `<Waveform className>` used to reach only a transient "Loading waveform..."
// placeholder; once the playlist rendered, the class was gone. It now goes on
// the playlist's outermost element.
import './jsdom-polyfills'; // must be first
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import { ThemeProvider } from 'styled-components';
import { Playlist } from '../components/Playlist';
import { defaultTheme } from '../wfpl-theme';

afterEach(cleanup);

describe('Playlist className', () => {
  it('puts className on the outermost element, next to the state attribute', () => {
    const { container } = render(
      <ThemeProvider theme={defaultTheme}>
        <Playlist theme={defaultTheme} className="my-playlist" data-playlist-state="ready" />
      </ThemeProvider>
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('data-playlist-state')).toBe('ready');
    expect(root.classList.contains('my-playlist')).toBe(true);
  });
});
