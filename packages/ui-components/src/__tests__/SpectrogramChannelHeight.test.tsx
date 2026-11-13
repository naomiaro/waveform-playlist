import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { SpectrogramChannel } from '../components/SpectrogramChannel';
import { defaultTheme } from '../wfpl-theme';

// #689: the spectrogram provider renders at the height a canvas registered
// with (the row height is an option of the view, which the provider does not
// know). A transferred canvas cannot be resized from the page, so a new
// height means new canvases, registered again.

describe('SpectrogramChannel and its height', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('registers each canvas with its height, and again when the height changes', () => {
    // jsdom has no transferControlToOffscreen.
    (
      HTMLCanvasElement.prototype as unknown as { transferControlToOffscreen: () => unknown }
    ).transferControlToOffscreen = function () {
      return {};
    };
    const registered: Array<{ canvasId: string; heightPx: number }> = [];
    const onCanvasRegister = (reg: { canvasId: string; heightPx: number }) => {
      registered.push({ canvasId: reg.canvasId, heightPx: reg.heightPx });
    };
    const onCanvasUnregister = vi.fn();
    const props = {
      index: 0,
      length: 300,
      samplesPerPixel: 1000,
      clipId: 'clip',
      onCanvasRegister,
      onCanvasUnregister,
    };
    const { rerender, container } = render(<SpectrogramChannel {...props} waveHeight={100} />);
    expect(registered.map((r) => r.heightPx)).toEqual([100]);
    const before = container.querySelector('canvas');

    rerender(<SpectrogramChannel {...props} waveHeight={50} />);
    expect(registered.map((r) => r.heightPx)).toEqual([100, 50]);
    expect(registered[1].canvasId).toBe(registered[0].canvasId);
    expect(container.querySelector('canvas')).not.toBe(before);
    // The id is registered again over the old canvas: nothing is unregistered,
    // which would drop the height the provider just learned.
    expect(onCanvasUnregister).not.toHaveBeenCalled();

    // The same height again registers nothing.
    rerender(<SpectrogramChannel {...props} waveHeight={50} />);
    expect(registered.length).toBe(2);
    delete (HTMLCanvasElement.prototype as unknown as { transferControlToOffscreen?: unknown })
      .transferControlToOffscreen;
  });

  it('the area behind the canvases is the theme key, black without it', () => {
    const props = {
      index: 0,
      length: 300,
      waveHeight: 100,
      samplesPerPixel: 1000,
      clipId: '',
      onCanvasRegister: () => {},
      onCanvasUnregister: () => {},
    };
    const wrapperColour = (container: HTMLElement) =>
      getComputedStyle(container.firstElementChild as HTMLElement).backgroundColor;
    const plain = render(<SpectrogramChannel {...props} />);
    expect(wrapperColour(plain.container)).toBe('rgb(0, 0, 0)');
    plain.unmount();
    const themed = render(
      <ThemeProvider theme={{ ...defaultTheme, spectrogramBackgroundColor: 'rgb(5, 6, 7)' }}>
        <SpectrogramChannel {...props} />
      </ThemeProvider>
    );
    expect(wrapperColour(themed.container)).toBe('rgb(5, 6, 7)');
  });
});
