import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SpectrogramChannel } from '../components/SpectrogramChannel';

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
    const props = {
      index: 0,
      length: 300,
      samplesPerPixel: 1000,
      clipId: 'clip',
      onCanvasRegister,
      onCanvasUnregister: () => {},
    };
    const { rerender, container } = render(<SpectrogramChannel {...props} waveHeight={100} />);
    expect(registered.map((r) => r.heightPx)).toEqual([100]);
    const before = container.querySelector('canvas');

    rerender(<SpectrogramChannel {...props} waveHeight={50} />);
    expect(registered.map((r) => r.heightPx)).toEqual([100, 50]);
    expect(registered[1].canvasId).toBe(registered[0].canvasId);
    expect(container.querySelector('canvas')).not.toBe(before);

    // The same height again registers nothing.
    rerender(<SpectrogramChannel {...props} waveHeight={50} />);
    expect(registered.length).toBe(2);
    delete (HTMLCanvasElement.prototype as unknown as { transferControlToOffscreen?: unknown })
      .transferControlToOffscreen;
  });
});
