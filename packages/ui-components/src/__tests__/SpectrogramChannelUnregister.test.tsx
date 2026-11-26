import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Activity, StrictMode } from 'react';
import { SpectrogramChannel } from '../components/SpectrogramChannel';

// #856: a canvas whose key changes (length, height, registered range) remounts
// and registers again under the same id. The id must be held once, so the
// unmount unregisters it once.

type TransferStub = { transferControlToOffscreen?: () => unknown };

describe('SpectrogramChannel unregisters each canvas id once', () => {
  beforeEach(() => {
    // jsdom has no transferControlToOffscreen.
    (HTMLCanvasElement.prototype as unknown as TransferStub).transferControlToOffscreen =
      function () {
        return {};
      };
  });

  afterEach(() => {
    cleanup();
    delete (HTMLCanvasElement.prototype as unknown as TransferStub).transferControlToOffscreen;
    vi.restoreAllMocks();
  });

  const baseProps = {
    index: 0,
    samplesPerPixel: 1000,
    clipId: 'clip',
  };

  it('after several remounts under the same ids, the unmount unregisters each id once', () => {
    const registered: string[] = [];
    const unregistered: string[] = [];
    const props = {
      ...baseProps,
      // Two chunks: 1000 px each at most.
      length: 1500,
      onCanvasRegister: (reg: { canvasId: string }) => registered.push(reg.canvasId),
      onCanvasUnregister: (id: string) => unregistered.push(id),
    };
    const { rerender, unmount } = render(<SpectrogramChannel {...props} waveHeight={100} />);
    const ids = [...registered];
    expect(ids).toHaveLength(2);

    // Each new height remounts both canvases, registered again over the same ids.
    for (const waveHeight of [90, 80, 70, 60]) {
      rerender(<SpectrogramChannel {...props} waveHeight={waveHeight} />);
    }
    expect(registered).toHaveLength(10);
    expect(new Set(registered)).toEqual(new Set(ids));
    expect(unregistered).toEqual([]);

    unmount();
    expect([...unregistered].sort()).toEqual([...ids].sort());
  });

  it('a chunk scrolled away after remounts is unregistered once, and not again at unmount', () => {
    const registered: string[] = [];
    const unregistered: string[] = [];
    const props = {
      ...baseProps,
      waveHeight: 100,
      onCanvasRegister: (reg: { canvasId: string }) => registered.push(reg.canvasId),
      onCanvasUnregister: (id: string) => unregistered.push(id),
    };
    const { rerender, unmount } = render(<SpectrogramChannel {...props} length={1500} />);
    const [first, second] = registered;
    // Remount both twice under the same ids.
    rerender(<SpectrogramChannel {...props} length={1500} offsetSamples={10} />);
    rerender(<SpectrogramChannel {...props} length={1500} offsetSamples={20} />);
    expect(unregistered).toEqual([]);

    // A shorter clip has one chunk: the second canvas unmounts.
    rerender(<SpectrogramChannel {...props} length={800} offsetSamples={20} />);
    expect(unregistered).toEqual([second]);

    unmount();
    expect(unregistered).toEqual([second, first]);
  });

  it('under StrictMode, a mounted canvas stays registered after the simulated remount', () => {
    const log: string[] = [];
    render(
      <StrictMode>
        <SpectrogramChannel
          {...baseProps}
          length={500}
          waveHeight={100}
          onCanvasRegister={(reg) => log.push(`register ${reg.canvasId}`)}
          onCanvasUnregister={(id) => log.push(`unregister ${id}`)}
        />
      </StrictMode>
    );
    expect(log).toEqual(['register clip-ch0-chunk0']);
  });

  it('a hidden <Activity> keeps the canvas registered, and the unmount after it unregisters it', () => {
    const log: string[] = [];
    const channel = (
      <SpectrogramChannel
        {...baseProps}
        length={500}
        waveHeight={100}
        onCanvasRegister={(reg) => log.push(`register ${reg.canvasId}`)}
        onCanvasUnregister={(id) => log.push(`unregister ${id}`)}
      />
    );
    const { rerender, unmount } = render(<Activity mode="visible">{channel}</Activity>);
    rerender(<Activity mode="hidden">{channel}</Activity>);
    rerender(<Activity mode="visible">{channel}</Activity>);
    expect(log).toEqual(['register clip-ch0-chunk0']);

    unmount();
    expect(log).toEqual(['register clip-ch0-chunk0', 'unregister clip-ch0-chunk0']);
  });
});
