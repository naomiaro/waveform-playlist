// @vitest-environment jsdom
//
// The body of a placeholder clip without peaks (#812): a box that fills the
// clip's channel area (the clip's width, the height below its header) in the
// colour the waveform's bars are drawn in, so the clip's extent shows with or
// without a header. It is drawn inside the clip, which already dims it.
import './jsdom-polyfills'; // must be first
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { DragDropProvider } from '@dnd-kit/react';
import { Clip } from '../components/Clip';
import { ClipPlaceholderBody } from '../components/ClipPlaceholderBody';
import { defaultTheme, type WaveformGradient, type WaveformPlaylistTheme } from '../wfpl-theme';

afterEach(cleanup);

const SAMPLES_PER_PIXEL = 100;
const DURATION_SAMPLES = 48000;
const CLIP_WIDTH_PX = DURATION_SAMPLES / SAMPLES_PER_PIXEL;

interface Options {
  theme?: Partial<WaveformPlaylistTheme>;
  isSelected?: boolean;
  showHeader?: boolean;
}

function placeholder({ theme = {}, isSelected = false, showHeader = true }: Options = {}) {
  const { container } = render(
    <ThemeProvider theme={{ ...defaultTheme, ...theme }}>
      <DragDropProvider>
        <Clip
          clipId="c1"
          trackIndex={0}
          clipIndex={0}
          trackName="Vocals"
          startSample={0}
          durationSamples={DURATION_SAMPLES}
          samplesPerPixel={SAMPLES_PER_PIXEL}
          showHeader={showHeader}
          isSelected={isSelected}
          isPlaceholder
        >
          <ClipPlaceholderBody isSelected={isSelected} />
        </Clip>
      </DragDropProvider>
    </ThemeProvider>
  );
  const clip = container.querySelector('[data-clip-container]') as HTMLElement;
  const body = container.querySelector('[data-clip-placeholder-body]') as HTMLElement | null;
  return { clip, body };
}

describe('ClipPlaceholderBody', () => {
  it('a placeholder without peaks draws a body of the clip width and the channel area height', () => {
    const { clip, body } = placeholder();
    expect(body).not.toBeNull();
    expect(body!.getAttribute('data-clip-placeholder-body')).toBe('true');
    // The clip is as wide as its duration; the body fills the area below the
    // header (the channels' wrapper, the clip's second child) edge to edge.
    expect(clip.style.width).toBe(`${CLIP_WIDTH_PX}px`);
    expect(clip.children).toHaveLength(2);
    expect(body!.parentElement).toBe(clip.children[1]);
    const style = getComputedStyle(body!);
    expect(style.position).toBe('absolute');
    expect([style.top, style.left, style.width, style.height]).toEqual([
      '0px',
      '0px',
      '100%',
      '100%',
    ]);
    // Inherited from the clip container: a press passes through to the
    // click overlay, as on every part of a clip but its handles.
    expect(style.pointerEvents).toBe('none');
    // No text, nothing a drag can start from.
    expect(body!.textContent).toBe('');
    expect(body!.children).toHaveLength(0);
  });

  it('the body is drawn without clip headers too', () => {
    const { clip, body } = placeholder({ showHeader: false });
    expect(clip.children).toHaveLength(1);
    expect(body!.parentElement).toBe(clip.children[0]);
  });

  it('is filled with the colour of the bars: waveFillColor in both draw modes, the selected one when selected', () => {
    for (const waveformDrawMode of ['inverted', 'normal'] as const) {
      const theme = { waveformDrawMode, waveFillColor: '#123456', waveOutlineColor: '#abcdef' };
      expect(placeholder({ theme }).body!.style.background).toBe('rgb(18, 52, 86)');
      cleanup();
      const selected = placeholder({
        theme: { ...theme, selectedWaveFillColor: '#654321' },
        isSelected: true,
      });
      expect(selected.body!.style.background).toBe('rgb(101, 67, 33)');
      cleanup();
    }
  });

  it('a selected clip without a selected colour in the theme takes the unselected one', () => {
    const theme = { waveFillColor: '#123456', selectedWaveFillColor: '' };
    expect(placeholder({ theme, isSelected: true }).body!.style.background).toBe('rgb(18, 52, 86)');
  });

  it('a gradient colour is drawn as a gradient', () => {
    const gradient: WaveformGradient = {
      type: 'linear',
      direction: 'horizontal',
      stops: [
        { offset: 0, color: 'red' },
        { offset: 1, color: 'blue' },
      ],
    };
    const { body } = placeholder({ theme: { waveFillColor: gradient } });
    expect(body!.style.background).toBe('linear-gradient(to right, red 0%, blue 100%)');
  });

  it('a colour that is neither a string nor a gradient does not throw: grey, as the channel', () => {
    for (const bad of [42, null, undefined, {}, { type: 'linear' }]) {
      const theme = { waveFillColor: bad as unknown as string };
      expect(placeholder({ theme }).body!.style.background).toBe('grey');
      cleanup();
    }
  });
});
