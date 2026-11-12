// #688, part 3: `PlayheadProps` is the seven props both providers can give.
// `PlayheadWithMarker` places itself from `visualTimeRef` and nothing else.
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlayheadWithMarker, type PlayheadProps } from '../components/Playhead';

let frames: FrameRequestCallback[];
let originalRAF: typeof requestAnimationFrame;
let originalCAF: typeof cancelAnimationFrame;

beforeEach(() => {
  frames = [];
  originalRAF = globalThis.requestAnimationFrame;
  originalCAF = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => frames.push(cb);
  globalThis.cancelAnimationFrame = (id: number) => {
    delete frames[id - 1];
  };
});

afterEach(() => {
  cleanup();
  globalThis.requestAnimationFrame = originalRAF;
  globalThis.cancelAnimationFrame = originalCAF;
});

const runFrame = () =>
  act(() => {
    const pending = frames.filter(Boolean);
    frames = [];
    for (const cb of pending) cb(0);
  });

// 1000 Hz at 100 samples per pixel: 10 px per second.
function makeProps(overrides: Partial<PlayheadProps> = {}): PlayheadProps {
  return {
    position: 0,
    isPlaying: false,
    // Raw and visual time differ (an output latency): the marker must use the
    // visual one.
    currentTimeRef: { current: 9 },
    visualTimeRef: { current: 2 },
    samplesPerPixel: 100,
    sampleRate: 1000,
    ...overrides,
  };
}

const transformOf = (container: HTMLElement) =>
  (container.firstElementChild as HTMLElement).style.transform;

describe('PlayheadWithMarker', () => {
  it('at rest it sits at visualTimeRef, and follows it on a re-render, with no frame requested', () => {
    const props = makeProps();
    const { container, rerender } = render(<PlayheadWithMarker {...props} />);
    expect(transformOf(container)).toBe('translate3d(20px, 0, 0)');

    (props.visualTimeRef as { current: number }).current = 3.5;
    rerender(<PlayheadWithMarker {...props} />);
    expect(transformOf(container)).toBe('translate3d(35px, 0, 0)');
    expect(frames.filter(Boolean)).toHaveLength(0);
  });

  it('while playing it follows visualTimeRef on every frame, and stops asking for frames when playback stops', () => {
    const props = makeProps({ isPlaying: true });
    const { container, rerender } = render(<PlayheadWithMarker {...props} />);
    const visual = props.visualTimeRef as { current: number };

    visual.current = 4;
    runFrame();
    expect(transformOf(container)).toBe('translate3d(40px, 0, 0)');
    visual.current = 4.5;
    runFrame();
    expect(transformOf(container)).toBe('translate3d(45px, 0, 0)');
    expect(frames.filter(Boolean)).toHaveLength(1);

    visual.current = 1;
    rerender(<PlayheadWithMarker {...props} isPlaying={false} />);
    expect(transformOf(container)).toBe('translate3d(10px, 0, 0)');
    expect(frames.filter(Boolean)).toHaveLength(0);
  });

  it('works as a render function given exactly the seven props', () => {
    const props = makeProps({ color: 'rgb(1, 2, 3)' });
    const Wrapper: React.FC = () => PlayheadWithMarker(props) as React.ReactElement;
    const { container } = render(<Wrapper />);
    expect(transformOf(container)).toBe('translate3d(20px, 0, 0)');
  });
});
