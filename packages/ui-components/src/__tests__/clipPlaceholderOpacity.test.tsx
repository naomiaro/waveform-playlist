// @vitest-environment jsdom
//
// A placeholder clip (its audio is still loading) is dimmed by
// theme.placeholderClipOpacity, 0.5 when the theme does not say (#812). A
// loaded clip sets no opacity at all.
import './jsdom-polyfills'; // must be first
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { DragDropProvider } from '@dnd-kit/react';
import { Clip } from '../components/Clip';
import { defaultTheme, type WaveformPlaylistTheme } from '../wfpl-theme';

afterEach(cleanup);

function opacityOf(isPlaceholder: boolean, theme: Partial<WaveformPlaylistTheme> = {}): string {
  const { container } = render(
    <ThemeProvider theme={{ ...defaultTheme, ...theme }}>
      <DragDropProvider>
        <Clip
          clipId="c1"
          trackIndex={0}
          clipIndex={0}
          trackName="Track 1"
          startSample={0}
          durationSamples={48000}
          samplesPerPixel={100}
          showHeader
          isPlaceholder={isPlaceholder}
        />
      </DragDropProvider>
    </ThemeProvider>
  );
  const clip = container.querySelector('[data-clip-container]') as HTMLElement;
  return getComputedStyle(clip).opacity;
}

describe('Clip placeholder opacity', () => {
  it('a placeholder clip is drawn at 0.5 opacity when the theme does not set placeholderClipOpacity', () => {
    expect(defaultTheme.placeholderClipOpacity).toBeUndefined();
    expect(opacityOf(true)).toBe('0.5');
  });

  it('a placeholder clip takes its opacity from theme.placeholderClipOpacity', () => {
    expect(opacityOf(true, { placeholderClipOpacity: 0.25 })).toBe('0.25');
    cleanup();
    expect(opacityOf(true, { placeholderClipOpacity: 0 })).toBe('0');
  });

  it('a loaded clip sets no opacity whatever the theme says', () => {
    expect(opacityOf(false, { placeholderClipOpacity: 0.25 })).toBe('');
    cleanup();
    expect(opacityOf(false)).toBe('');
  });

  it('a theme value outside 0 to 1 falls back to 0.5', () => {
    for (const bad of [
      1.5,
      -0.1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      '0.2' as unknown as number,
    ]) {
      expect(opacityOf(true, { placeholderClipOpacity: bad })).toBe('0.5');
      cleanup();
    }
  });
});
