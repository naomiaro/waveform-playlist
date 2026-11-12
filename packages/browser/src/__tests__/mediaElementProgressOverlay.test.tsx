// @vitest-environment jsdom
//
// The MediaElement progress overlay is animated every frame during playback. It
// must change `transform` (composite only), not `width` (layout), the same as
// ChannelWithProgress does for the multi-track provider.
import './jsdom-polyfills'; // must be first
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const animation = { isPlaying: false };
// What the provider gives its own components: the resting position and the
// frame-callback registry its one animation loop drives (#769).
const internals = vi.hoisted(() => {
  const callbacks = new Map<string, (data: { visualTime: number }) => void>();
  return {
    callbacks,
    visualTimeRef: { current: 0 },
    registerFrameCallback: (id: string, cb: (data: { visualTime: number }) => void) => {
      callbacks.set(id, cb);
    },
    unregisterFrameCallback: (id: string) => {
      callbacks.delete(id);
    },
  };
});

vi.mock('../MediaElementPlaylistContext', () => ({
  useMediaElementAnimation: () => animation,
  useMediaElementData: () => ({ samplesPerPixel: 100, sampleRate: 1000 }),
}));

vi.mock('../providerInternals/mediaElementInternalContexts', () => ({
  useMediaElementInternals: () => internals,
}));

vi.mock('@waveform-playlist/ui-components', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@waveform-playlist/ui-components')>()),
  SmartChannel: () => null,
  useTheme: () => ({ waveProgressColor: 'rgb(1, 2, 3)' }),
}));

import { ChannelWithMediaElementProgress } from '../components/ChannelWithMediaElementProgress';

// 10 s clip at 1000 Hz, 100 samples per pixel -> 100 px wide.
const props = {
  index: 0,
  data: new Int8Array(0),
  bits: 8 as const,
  length: 100,
  clipStartSample: 0,
  clipDurationSamples: 10000,
};

function overlayOf(container: HTMLElement): HTMLElement {
  // wrapper > [background, overlay, channel container]
  return (container.firstElementChild as HTMLElement).children[1] as HTMLElement;
}

let requestedFrames: number;
let originalRAF: typeof requestAnimationFrame;

beforeEach(() => {
  animation.isPlaying = false;
  internals.visualTimeRef.current = 0;
  internals.callbacks.clear();
  requestedFrames = 0;
  originalRAF = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => ++requestedFrames;
});

afterEach(() => {
  cleanup();
  globalThis.requestAnimationFrame = originalRAF;
});

/** One frame of the provider's loop at `time` seconds. */
function runFrame(time: number) {
  act(() => internals.callbacks.forEach((cb) => cb({ visualTime: time })));
}

describe('ChannelWithMediaElementProgress overlay', () => {
  it('is as wide as the channel and scaled to the played fraction when stopped', () => {
    internals.visualTimeRef.current = 2.5; // a quarter of the clip
    const { container } = render(<ChannelWithMediaElementProgress {...props} />);
    const overlay = overlayOf(container);
    expect(overlay.style.width).toBe('100px');
    expect(overlay.style.transform).toBe('scaleX(0.25)');
  });

  it('animates transform, not width, while playing', () => {
    animation.isPlaying = true;
    const { container } = render(<ChannelWithMediaElementProgress {...props} />);
    const overlay = overlayOf(container);

    expect(internals.callbacks.size).toBe(1);
    runFrame(5);
    expect(overlay.style.transform).toBe('scaleX(0.5)');
    expect(overlay.style.width).toBe('100px');

    runFrame(7.5);
    expect(overlay.style.transform).toBe('scaleX(0.75)');
    expect(overlay.style.width).toBe('100px');
    // The provider's loop is the only one: the overlay requests no frames.
    expect(requestedFrames).toBe(0);
  });

  it('registers with the loop only while playing, and unregisters on unmount', () => {
    const { rerender, unmount } = render(<ChannelWithMediaElementProgress {...props} />);
    expect(internals.callbacks.size).toBe(0);

    animation.isPlaying = true;
    rerender(<ChannelWithMediaElementProgress {...props} />);
    expect(internals.callbacks.size).toBe(1);

    animation.isPlaying = false;
    rerender(<ChannelWithMediaElementProgress {...props} />);
    expect(internals.callbacks.size).toBe(0);

    animation.isPlaying = true;
    rerender(<ChannelWithMediaElementProgress {...props} />);
    unmount();
    expect(internals.callbacks.size).toBe(0);
  });

  it('clamps before the clip and past its end', () => {
    internals.visualTimeRef.current = 99;
    const { container, rerender } = render(
      <ChannelWithMediaElementProgress {...props} clipStartSample={5000} />
    );
    expect(overlayOf(container).style.transform).toBe('scaleX(1)');

    internals.visualTimeRef.current = 1; // before clipStartSample
    rerender(<ChannelWithMediaElementProgress {...props} clipStartSample={5000} />);
    expect(overlayOf(container).style.transform).toBe('scaleX(0)');
  });

  it('keeps geometry in inline styles so a new width reuses the CSS class', () => {
    const { container, rerender } = render(<ChannelWithMediaElementProgress {...props} />);
    const overlay = overlayOf(container);
    const background = (container.firstElementChild as HTMLElement).children[0] as HTMLElement;
    const classes = [overlay.className, background.className];

    rerender(<ChannelWithMediaElementProgress {...props} length={101} />);
    expect(overlay.style.width).toBe('101px');
    expect(background.style.width).toBe('101px');
    expect([overlay.className, background.className]).toEqual(classes);
  });
});
