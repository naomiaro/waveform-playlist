// @vitest-environment jsdom
//
// The progress overlay of a channel (one component for both providers since
// #688, part 3) is animated every frame during playback. It must change
// `transform` (composite only), not `width` (layout). It is as wide as the
// CLIP; the background behind the waveform is as wide as the PEAKS.
import './jsdom-polyfills'; // must be first
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const animation = { isPlaying: false };
const themeColors = vi.hoisted(() => ({
  waveProgressColor: 'rgb(1, 2, 3)',
  waveFillColor: 'rgb(10, 20, 30)',
  selectedWaveFillColor: undefined as string | undefined,
  waveformDrawMode: undefined as 'inverted' | 'normal' | undefined,
  waveOutlineColor: 'rgb(70, 80, 90)',
  selectedWaveOutlineColor: undefined as string | undefined,
}));
// What usePlaybackRefs() gives: the position to draw and the frame-callback
// registry the provider's one animation loop drives (#769, #688).
const internals = vi.hoisted(() => {
  const callbacks = new Map<string, (data: { visualTime: number; sampleRate: number }) => void>();
  return {
    callbacks,
    visualTimeRef: { current: 0 },
    currentTimeRef: { current: 0 },
    registerFrameCallback: (
      id: string,
      cb: (data: { visualTime: number; sampleRate: number }) => void
    ) => {
      callbacks.set(id, cb);
    },
    unregisterFrameCallback: (id: string) => {
      callbacks.delete(id);
    },
  };
});

// The inner progress child reads these; the channel itself reads none of them.
vi.mock('../contexts/playlistContexts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../contexts/playlistContexts')>()),
  useIsPlaying: () => animation,
  useCurrentTime: () => ({ currentTime: 0 }),
  usePlaylistView: () => ({ sampleRate: 1000 }),
  usePlaylistZoom: () => ({ samplesPerPixel: 100 }),
  usePlaybackRefs: () => internals,
}));

vi.mock('@waveform-playlist/ui-components', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@waveform-playlist/ui-components')>()),
  SmartChannel: () => null,
  useTheme: () => ({ ...themeColors }),
}));

import { ChannelWithProgress } from '../components/ChannelWithProgress';

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
  themeColors.selectedWaveFillColor = undefined;
  themeColors.selectedWaveOutlineColor = undefined;
  themeColors.waveformDrawMode = undefined;
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
  // FrameData: callbacks take the sample rate from the frame, not from a render.
  act(() => internals.callbacks.forEach((cb) => cb({ visualTime: time, sampleRate: 1000 })));
}

describe('ChannelWithProgress overlay', () => {
  it('is as wide as the channel and scaled to the played fraction when stopped', () => {
    internals.visualTimeRef.current = 2.5; // a quarter of the clip
    const { container } = render(<ChannelWithProgress {...props} />);
    const overlay = overlayOf(container);
    expect(overlay.style.width).toBe('100px');
    expect(overlay.style.transform).toBe('scaleX(0.25)');
  });

  it('animates transform, not width, while playing', () => {
    animation.isPlaying = true;
    const { container } = render(<ChannelWithProgress {...props} />);
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
    const { rerender, unmount } = render(<ChannelWithProgress {...props} />);
    expect(internals.callbacks.size).toBe(0);

    animation.isPlaying = true;
    rerender(<ChannelWithProgress {...props} />);
    expect(internals.callbacks.size).toBe(1);

    animation.isPlaying = false;
    rerender(<ChannelWithProgress {...props} />);
    expect(internals.callbacks.size).toBe(0);

    animation.isPlaying = true;
    rerender(<ChannelWithProgress {...props} />);
    unmount();
    expect(internals.callbacks.size).toBe(0);
  });

  it('clamps before the clip and past its end', () => {
    internals.visualTimeRef.current = 99;
    const { container, rerender } = render(
      <ChannelWithProgress {...props} clipStartSample={5000} />
    );
    expect(overlayOf(container).style.transform).toBe('scaleX(1)');

    internals.visualTimeRef.current = 1; // before clipStartSample
    rerender(<ChannelWithProgress {...props} clipStartSample={5000} />);
    expect(overlayOf(container).style.transform).toBe('scaleX(0)');
  });

  it('keeps geometry in inline styles so a new width reuses the CSS class', () => {
    const { container, rerender } = render(<ChannelWithProgress {...props} />);
    const overlay = overlayOf(container);
    const background = (container.firstElementChild as HTMLElement).children[0] as HTMLElement;
    const classes = [overlay.className, background.className];

    rerender(<ChannelWithProgress {...props} length={101} clipDurationSamples={10100} />);
    expect(overlay.style.width).toBe('101px');
    expect(background.style.width).toBe('101px');
    expect([overlay.className, background.className]).toEqual(classes);
  });

  it('the overlay is as wide as the clip, the background as wide as the peaks', () => {
    // Peaks one pixel short of the clip (audio shorter than the clip's length).
    internals.visualTimeRef.current = 5;
    const { container } = render(<ChannelWithProgress {...props} length={99} />);
    const overlay = overlayOf(container);
    const background = (container.firstElementChild as HTMLElement).children[0] as HTMLElement;
    expect(overlay.style.width).toBe('100px');
    expect(background.style.width).toBe('99px');
    // Half the clip's time is half the overlay: 50 px, where the playhead is.
    expect(overlay.style.transform).toBe('scaleX(0.5)');
  });

  it('a selected channel uses the selected colour, and the unselected one when the theme has none', () => {
    const { container, rerender } = render(<ChannelWithProgress {...props} />);
    const background = () =>
      (container.firstElementChild as HTMLElement).children[0] as HTMLElement;
    expect(background().style.background).toBe('rgb(10, 20, 30)');
    themeColors.selectedWaveFillColor = 'rgb(40, 50, 60)';
    rerender(<ChannelWithProgress {...props} isSelected />);
    expect(background().style.background).toBe('rgb(40, 50, 60)');
    themeColors.selectedWaveFillColor = undefined;
    rerender(<ChannelWithProgress {...props} isSelected length={100} />);
    expect(background().style.background).toBe('rgb(10, 20, 30)');
  });

  it('normal draw mode: the outline colours, with the same fallback', () => {
    themeColors.waveformDrawMode = 'normal';
    const { container, rerender } = render(<ChannelWithProgress {...props} isSelected />);
    const background = () =>
      (container.firstElementChild as HTMLElement).children[0] as HTMLElement;
    expect(background().style.background).toBe('rgb(70, 80, 90)');
    themeColors.selectedWaveOutlineColor = 'rgb(100, 110, 120)';
    rerender(<ChannelWithProgress {...props} isSelected length={100} />);
    expect(background().style.background).toBe('rgb(100, 110, 120)');
    rerender(<ChannelWithProgress {...props} />);
    expect(background().style.background).toBe('rgb(70, 80, 90)');
  });
});
