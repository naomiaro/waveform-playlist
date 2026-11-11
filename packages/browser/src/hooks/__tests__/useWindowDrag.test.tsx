// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useWindowDrag, clampedOffsetX } from '../useWindowDrag';

afterEach(() => {
  cleanup();
});

describe('useWindowDrag', () => {
  it('reports moves and the release from anywhere in the window while active', () => {
    const onMove = vi.fn();
    const onEnd = vi.fn();
    renderHook(() => useWindowDrag(true, onMove, onEnd));

    const move = new MouseEvent('mousemove', { clientX: 40, buttons: 1 });
    const up = new MouseEvent('mouseup', { clientX: 55 });
    window.dispatchEvent(move);
    window.dispatchEvent(up);

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith(move);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith(up);
  });

  it('ends with null when the window loses focus mid-drag (the mouseup never arrives)', () => {
    const onEnd = vi.fn();
    renderHook(() => useWindowDrag(true, vi.fn(), onEnd));

    window.dispatchEvent(new Event('blur'));

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith(null);
  });

  it('ends with null on a move with the primary button no longer held (a lost mouseup)', () => {
    const onMove = vi.fn();
    const onEnd = vi.fn();
    renderHook(() => useWindowDrag(true, onMove, onEnd));

    window.dispatchEvent(new MouseEvent('mousemove', { buttons: 0 }));
    // Only the secondary button held: not this drag either.
    window.dispatchEvent(new MouseEvent('mousemove', { buttons: 2 }));

    expect(onMove).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(2);
    expect(onEnd).toHaveBeenCalledWith(null);
  });

  it('hears a release that another listener stops from propagating', () => {
    const onEnd = vi.fn();
    renderHook(() => useWindowDrag(true, vi.fn(), onEnd));
    const stop = (event: Event) => event.stopPropagation();
    document.body.addEventListener('mouseup', stop);

    document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    document.body.removeEventListener('mouseup', stop);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('does not listen while inactive', () => {
    const onMove = vi.fn();
    const onEnd = vi.fn();
    renderHook(() => useWindowDrag(false, onMove, onEnd));

    window.dispatchEvent(new MouseEvent('mousemove', { buttons: 1 }));
    window.dispatchEvent(new MouseEvent('mouseup'));
    window.dispatchEvent(new Event('blur'));

    expect(onMove).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('stops listening when it becomes inactive and on unmount', () => {
    const onMove = vi.fn();
    const onEnd = vi.fn();
    const { rerender, unmount } = renderHook(({ active }) => useWindowDrag(active, onMove, onEnd), {
      initialProps: { active: true },
    });

    rerender({ active: false });
    window.dispatchEvent(new MouseEvent('mousemove', { buttons: 1 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    rerender({ active: true });
    unmount();
    window.dispatchEvent(new MouseEvent('mousemove', { buttons: 1 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(onMove).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('switches page text selection off for the drag and restores what was there', () => {
    const root = document.documentElement;
    root.style.userSelect = 'text';
    const { rerender } = renderHook(({ active }) => useWindowDrag(active, vi.fn(), vi.fn()), {
      initialProps: { active: false },
    });
    expect(root.style.userSelect).toBe('text');

    rerender({ active: true });
    expect(root.style.userSelect).toBe('none');

    rerender({ active: false });
    expect(root.style.userSelect).toBe('text');
    root.style.userSelect = '';
  });

  it('two drags at once restore text selection only when both have ended', () => {
    const root = document.documentElement;
    root.style.userSelect = '';
    const first = renderHook(() => useWindowDrag(true, vi.fn(), vi.fn()));
    const second = renderHook(() => useWindowDrag(true, vi.fn(), vi.fn()));
    expect(root.style.userSelect).toBe('none');

    first.unmount();
    expect(root.style.userSelect).toBe('none');
    second.unmount();
    expect(root.style.userSelect).toBe('');
  });

  it('calls the latest callbacks without re-subscribing', () => {
    const first = vi.fn();
    const second = vi.fn();
    const add = vi.spyOn(window, 'addEventListener');
    const { rerender } = renderHook(({ cb }) => useWindowDrag(true, cb, cb), {
      initialProps: { cb: first },
    });
    const subscriptions = add.mock.calls.length;

    rerender({ cb: second });
    window.dispatchEvent(new MouseEvent('mousemove', { buttons: 1 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(add.mock.calls.length).toBe(subscriptions);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(2);
    add.mockRestore();
  });
});

describe('clampedOffsetX', () => {
  const element = {
    isConnected: true,
    getBoundingClientRect: () => ({ left: 100, width: 400 }),
  } as unknown as Element;

  it('is the distance from the left edge inside the element', () => {
    expect(clampedOffsetX(element, 250)).toBe(150);
  });

  it('is 0 to the left of the element and its width to the right', () => {
    expect(clampedOffsetX(element, 20)).toBe(0);
    expect(clampedOffsetX(element, 900)).toBe(400);
  });

  it('is null for an element that has left the document', () => {
    const detached = document.createElement('div');
    expect(clampedOffsetX(detached, 250)).toBeNull();
  });
});
