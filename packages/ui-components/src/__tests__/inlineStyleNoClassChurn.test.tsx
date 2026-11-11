// Values that change continuously (track width while zooming or recording, the
// track menu position while scrolling) must be inline styles. Interpolating them
// in a styled-components template generates one CSS class per distinct value.
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Track } from '../components/Track';
import { TrackMenu } from '../components/TrackMenu';

let frames: Map<number, FrameRequestCallback>;
let nextFrameId: number;
let originalRAF: typeof requestAnimationFrame;
let originalCAF: typeof cancelAnimationFrame;

function flushFrames() {
  const pending = [...frames.values()];
  frames.clear();
  act(() => {
    pending.forEach((cb) => cb(0));
  });
}

beforeEach(() => {
  frames = new Map();
  nextFrameId = 1;
  originalRAF = globalThis.requestAnimationFrame;
  originalCAF = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
    const id = nextFrameId++;
    frames.set(id, cb);
    return id;
  };
  globalThis.cancelAnimationFrame = (id: number) => {
    frames.delete(id);
  };
});

afterEach(() => {
  cleanup();
  globalThis.requestAnimationFrame = originalRAF;
  globalThis.cancelAnimationFrame = originalCAF;
  vi.restoreAllMocks();
});

describe('Track width', () => {
  it('is an inline style, so a new width reuses the same CSS class', () => {
    const { container, rerender } = render(<Track numChannels={1} width={1000} />);
    const el = container.firstElementChild as HTMLElement;
    const classBefore = el.className;
    expect(el.style.width).toBe('1000px');

    rerender(<Track numChannels={1} width={1001} />);
    expect(el.style.width).toBe('1001px');
    expect(el.className).toBe(classBefore);
  });

  it('sets no width when the prop is omitted', () => {
    const { container } = render(<Track numChannels={1} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.width).toBe('');
  });
});

describe('TrackMenu position', () => {
  function rect(top: number, left: number): DOMRect {
    const width = 20;
    const height = 20;
    return {
      top,
      left,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    };
  }

  function openMenu() {
    const utils = render(
      <TrackMenu items={[{ id: 'a', content: <span data-testid="item">Item</span> }]} />
    );
    const button = utils.getByRole('button', { name: 'Track menu' });
    const measure = vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(rect(100, 50));
    fireEvent.click(button);
    flushFrames();
    const dropdown = utils.getByTestId('item').parentElement as HTMLElement;
    return { ...utils, button, measure, dropdown };
  }

  it('positions the dropdown with inline styles and keeps one CSS class as it moves', () => {
    const { measure, dropdown } = openMenu();
    const classBefore = dropdown.className;
    expect(dropdown.style.top).toBe('100px');
    expect(dropdown.style.left).toBe('74px');

    measure.mockReturnValue(rect(60, 50));
    fireEvent.scroll(window);
    flushFrames();

    expect(dropdown.style.top).toBe('60px');
    expect(dropdown.className).toBe(classBefore);
  });

  it('measures once per animation frame however many scroll events arrive', () => {
    const { measure } = openMenu();
    measure.mockClear();

    fireEvent.scroll(window);
    fireEvent.scroll(window);
    fireEvent.scroll(window);
    fireEvent(window, new Event('resize'));
    expect(measure).not.toHaveBeenCalled();

    flushFrames();
    expect(measure).toHaveBeenCalledTimes(1);
  });

  it('listens for scroll passively, in the capture phase', () => {
    const add = vi.spyOn(window, 'addEventListener');
    openMenu();
    expect(add).toHaveBeenCalledWith('scroll', expect.any(Function), {
      capture: true,
      passive: true,
    });
  });

  it('cancels a pending measurement when the menu closes', () => {
    const { button, measure } = openMenu();
    fireEvent.scroll(window);
    measure.mockClear();

    fireEvent.click(button);
    flushFrames();
    expect(measure).not.toHaveBeenCalled();
  });
});
