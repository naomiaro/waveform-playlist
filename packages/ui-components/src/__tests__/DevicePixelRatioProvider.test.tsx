// Regression tests for #697: the provider used to call
// `matchMedia(...).addEventListener` in its render body, adding a listener on
// every render with no cleanup, and read `window.devicePixelRatio` when the
// module was evaluated.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import React from 'react';
import { DevicePixelRatioProvider, useDevicePixelRatio } from '../contexts/DevicePixelRatio';

interface FakeQuery {
  query: string;
  listeners: Set<() => void>;
}

let queries: FakeQuery[] = [];
const liveListenerCount = () => queries.reduce((n, q) => n + q.listeners.size, 0);

function setDevicePixelRatio(value: number) {
  Object.defineProperty(window, 'devicePixelRatio', { value, configurable: true });
}

let seen = 0;
const Probe: React.FC = () => {
  seen = useDevicePixelRatio();
  return null;
};

beforeEach(() => {
  queries = [];
  setDevicePixelRatio(1);
  vi.stubGlobal('matchMedia', (query: string) => {
    const entry: FakeQuery = { query, listeners: new Set() };
    queries.push(entry);
    return {
      media: query,
      matches: true,
      addEventListener: (_type: string, cb: () => void) => entry.listeners.add(cb),
      removeEventListener: (_type: string, cb: () => void) => entry.listeners.delete(cb),
    };
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DevicePixelRatioProvider', () => {
  it('keeps one media-query listener across re-renders and removes it on unmount', () => {
    const App = () => (
      <DevicePixelRatioProvider>
        <Probe />
      </DevicePixelRatioProvider>
    );
    const { rerender, unmount } = render(<App />);
    expect(liveListenerCount()).toBe(1);

    for (let i = 0; i < 5; i++) rerender(<App />);
    expect(liveListenerCount()).toBe(1);

    unmount();
    expect(liveListenerCount()).toBe(0);
  });

  it('follows a pixel-ratio change and re-subscribes for the new ratio', () => {
    render(
      <DevicePixelRatioProvider>
        <Probe />
      </DevicePixelRatioProvider>
    );
    expect(seen).toBe(1);

    setDevicePixelRatio(2);
    act(() => {
      queries.forEach((q) => q.listeners.forEach((cb) => cb()));
    });

    expect(seen).toBe(2);
    expect(liveListenerCount()).toBe(1);
    const live = queries.find((q) => q.listeners.size === 1);
    expect(live?.query).toContain('2dppx');
  });

  it('rounds a fractional ratio up, as before', () => {
    setDevicePixelRatio(1.5);
    render(
      <DevicePixelRatioProvider>
        <Probe />
      </DevicePixelRatioProvider>
    );
    expect(seen).toBe(2);
  });

  it('without a provider, the hook returns the live ratio, not one captured at import', () => {
    setDevicePixelRatio(3);
    const { rerender } = render(<Probe />);
    expect(seen).toBe(3);

    setDevicePixelRatio(1.25);
    rerender(<Probe />);
    expect(seen).toBe(1.25);
    expect(liveListenerCount()).toBe(0);
  });
});
