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

  // A canvas handed to the worker cannot be handed over again, so a canvas the
  // provider released is replaced by a fresh one when the effects run again.
  const logged = (log: string[]) => ({
    onCanvasRegister: (reg: { canvasId: string; canvas: unknown }) =>
      log.push(`register ${reg.canvasId}`),
    onCanvasUnregister: (id: string) => log.push(`unregister ${id}`),
  });

  it('under StrictMode, the simulated remount registers a fresh canvas for the one it released', () => {
    const log: string[] = [];
    const { container } = render(
      <StrictMode>
        <SpectrogramChannel {...baseProps} length={500} waveHeight={100} {...logged(log)} />
      </StrictMode>
    );
    expect(log).toEqual([
      'register clip-ch0-chunk0',
      'unregister clip-ch0-chunk0',
      'register clip-ch0-chunk0',
    ]);
    expect(container.querySelectorAll('canvas')).toHaveLength(1);
  });

  it('a hidden <Activity> releases the canvas; the reveal registers a fresh one', () => {
    const log: string[] = [];
    const channel = (
      <SpectrogramChannel {...baseProps} length={500} waveHeight={100} {...logged(log)} />
    );
    const { rerender, unmount, container } = render(<Activity mode="visible">{channel}</Activity>);
    const first = container.querySelector('canvas');
    rerender(<Activity mode="hidden">{channel}</Activity>);
    expect(log).toEqual(['register clip-ch0-chunk0', 'unregister clip-ch0-chunk0']);

    rerender(<Activity mode="visible">{channel}</Activity>);
    expect(log).toEqual([
      'register clip-ch0-chunk0',
      'unregister clip-ch0-chunk0',
      'register clip-ch0-chunk0',
    ]);
    expect(container.querySelector('canvas')).not.toBe(first);

    unmount();
    expect(log.slice(3)).toEqual(['unregister clip-ch0-chunk0']);
  });

  it('a channel deleted while its <Activity> is hidden leaves nothing registered', () => {
    const log: string[] = [];
    const channel = (
      <SpectrogramChannel {...baseProps} length={1500} waveHeight={100} {...logged(log)} />
    );
    const { rerender, unmount } = render(<Activity mode="visible">{channel}</Activity>);
    rerender(<Activity mode="hidden">{channel}</Activity>);
    // Deleted while hidden: React runs no cleanup for it after the hide's.
    rerender(
      <Activity mode="hidden">
        <div />
      </Activity>
    );
    unmount();
    expect(log).toEqual([
      'register clip-ch0-chunk0',
      'register clip-ch0-chunk1',
      'unregister clip-ch0-chunk0',
      'unregister clip-ch0-chunk1',
    ]);
  });

  it('a canvas released by a hide is not unregistered again when the reveal finds it gone', () => {
    // The clip gets shorter while hidden: its second canvas is gone at the reveal.
    const log: string[] = [];
    const channel = (length: number) => (
      <SpectrogramChannel {...baseProps} length={length} waveHeight={100} {...logged(log)} />
    );
    const { rerender, unmount } = render(<Activity mode="visible">{channel(1500)}</Activity>);
    rerender(<Activity mode="hidden">{channel(1500)}</Activity>);
    rerender(<Activity mode="hidden">{channel(800)}</Activity>);
    rerender(<Activity mode="visible">{channel(800)}</Activity>);
    unmount();

    // Replay the log: an unregister must name an id registered at that moment,
    // and nothing may stay registered after the unmount.
    const live = new Set<string>();
    const faults: string[] = [];
    for (const entry of log) {
      const [kind, id] = entry.split(' ');
      if (kind === 'register') live.add(id);
      else if (!live.delete(id)) faults.push(entry);
    }
    expect(faults).toEqual([]);
    expect([...live]).toEqual([]);
    expect(log.filter((e) => e === 'unregister clip-ch0-chunk1')).toHaveLength(1);
  });
});
