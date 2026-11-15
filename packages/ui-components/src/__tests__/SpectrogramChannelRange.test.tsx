import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { SpectrogramCanvasRegistration } from '@waveform-playlist/core';
import { SpectrogramChannel } from '../components/SpectrogramChannel';

// #812: the view draws a clip with a range of its audio the tracks may not
// have yet (a trim being dragged), and the spectrogram provider draws a canvas
// for the range it registered with. A transferred canvas cannot be registered
// again, so a new range means new canvases.

type Prototype = { transferControlToOffscreen?: () => unknown };

describe('SpectrogramChannel and the range of the audio it is drawn for', () => {
  beforeEach(() => {
    // jsdom has no transferControlToOffscreen.
    (HTMLCanvasElement.prototype as unknown as Prototype).transferControlToOffscreen = () => ({});
  });
  afterEach(() => {
    cleanup();
    delete (HTMLCanvasElement.prototype as unknown as Prototype).transferControlToOffscreen;
  });

  const baseProps = {
    index: 0,
    length: 1500,
    waveHeight: 80,
    samplesPerPixel: 1000,
    clipId: 'clip',
    onCanvasUnregister: () => {},
  };

  it('registers each canvas with the geometry it was given', () => {
    const registered: SpectrogramCanvasRegistration[] = [];
    render(
      <SpectrogramChannel
        {...baseProps}
        onCanvasRegister={(reg) => registered.push(reg)}
        offsetSamples={4800}
        durationSamples={1_500_000}
      />
    );
    // 1500 px: two chunks, both with the range.
    expect(
      registered.map(({ canvasId, offsetSamples, durationSamples }) => ({
        canvasId,
        offsetSamples,
        durationSamples,
      }))
    ).toEqual([
      { canvasId: 'clip-ch0-chunk0', offsetSamples: 4800, durationSamples: 1_500_000 },
      { canvasId: 'clip-ch0-chunk1', offsetSamples: 4800, durationSamples: 1_500_000 },
    ]);
  });

  it('a registration without a range has none (the provider uses the clip’s own)', () => {
    const registered: SpectrogramCanvasRegistration[] = [];
    render(<SpectrogramChannel {...baseProps} onCanvasRegister={(reg) => registered.push(reg)} />);
    expect(registered).toHaveLength(2);
    for (const reg of registered) {
      expect('offsetSamples' in reg).toBe(false);
      expect('durationSamples' in reg).toBe(false);
    }
  });

  it('re-registers when the geometry changes at the same pixel length', () => {
    const registered: SpectrogramCanvasRegistration[] = [];
    const onCanvasUnregister = vi.fn();
    const props = {
      ...baseProps,
      onCanvasRegister: (reg: SpectrogramCanvasRegistration) => registered.push(reg),
      onCanvasUnregister,
    };
    const { rerender, container } = render(
      <SpectrogramChannel {...props} offsetSamples={4800} durationSamples={1_500_000} />
    );
    const before = Array.from(container.querySelectorAll('canvas'));
    registered.length = 0;

    // A sub-pixel left trim: the offset and the duration change, the length does not.
    rerender(<SpectrogramChannel {...props} offsetSamples={5100} durationSamples={1_499_700} />);
    expect(registered.map((r) => [r.canvasId, r.offsetSamples, r.durationSamples])).toEqual([
      ['clip-ch0-chunk0', 5100, 1_499_700],
      ['clip-ch0-chunk1', 5100, 1_499_700],
    ]);
    // New canvases (the old ones were handed over), registered over the same ids.
    const after = Array.from(container.querySelectorAll('canvas'));
    expect(after).toHaveLength(2);
    for (const canvas of after) expect(before).not.toContain(canvas);
    expect(onCanvasUnregister).not.toHaveBeenCalled();

    // A right trim at the same length: only the duration changes.
    registered.length = 0;
    rerender(<SpectrogramChannel {...props} offsetSamples={5100} durationSamples={1_499_900} />);
    expect(registered.map((r) => r.durationSamples)).toEqual([1_499_900, 1_499_900]);

    // The same range again registers nothing.
    registered.length = 0;
    rerender(<SpectrogramChannel {...props} offsetSamples={5100} durationSamples={1_499_900} />);
    expect(registered).toHaveLength(0);
  });
});
