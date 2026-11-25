// @vitest-environment jsdom
//
// A key press runs the shortcuts of the last COMMITTED render (#895).
//
// The window listener reads the shortcuts from a ref. Written in a passive
// effect, the ref was a render behind between a commit and the passive-effects
// flush: for an update that does not come from a discrete event (the animation
// loop's `setIsPlaying(false)` at the end of a selection, a timer) React runs
// passive effects after paint, and a key pressed in that gap ran the previous
// render's handlers. Space then took the handler that still saw `isPlaying`
// true and paused instead of playing (spaceMatchesPlayButton.test.tsx failed
// now and then, on CI and locally). Here the key is sent from a layout effect
// of the commit that changed the handlers, which is exactly that gap, every
// time.
import { describe, it, expect, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import React, { useLayoutEffect, useState } from 'react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

const seen: string[] = [];

interface Props {
  label: string;
  enabled: boolean;
}

const Shortcuts: React.FC<Props> = ({ label, enabled }) => {
  useKeyboardShortcuts({
    shortcuts: [{ key: ' ', action: () => seen.push(label), description: 'record the label' }],
    enabled,
  });
  return null;
};

/**
 * Presses Space from a layout effect: after the commit, before passive effects.
 * Rendered AFTER `Shortcuts`: layout effects run in tree order.
 */
const PressInLayoutEffect: React.FC<Props & { pressOnMount?: boolean }> = ({
  label,
  pressOnMount = false,
}) => {
  useLayoutEffect(() => {
    if (label === 'first' && !pressOnMount) return;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  }, [label, pressOnMount]);
  return null;
};

let update: (props: Props) => void = () => {};

const Harness: React.FC<{ initiallyEnabled: boolean; pressOnMount?: boolean }> = ({
  initiallyEnabled,
  pressOnMount,
}) => {
  const [props, set] = useState<Props>({ label: 'first', enabled: initiallyEnabled });
  update = set;
  return (
    <>
      <Shortcuts {...props} />
      <PressInLayoutEffect {...props} pressOnMount={pressOnMount} />
    </>
  );
};

afterEach(() => {
  cleanup();
  seen.length = 0;
});

describe('useKeyboardShortcuts: a key pressed after a commit, before its passive effects', () => {
  it("runs that commit's handlers", () => {
    render(<Harness initiallyEnabled />);
    act(() => {
      update({ label: 'second', enabled: true });
    });
    expect(seen).toEqual(['second']);
  });

  it('runs nothing when that commit turned the shortcuts off', () => {
    render(<Harness initiallyEnabled />);
    act(() => {
      update({ label: 'second', enabled: false });
    });
    expect(seen).toEqual([]);
  });

  it('runs the handlers when that commit turned the shortcuts on', () => {
    render(<Harness initiallyEnabled={false} />);
    act(() => {
      update({ label: 'second', enabled: true });
    });
    expect(seen).toEqual(['second']);
  });

  it('runs the handlers when that commit mounted them', () => {
    render(<Harness initiallyEnabled pressOnMount />);
    expect(seen).toEqual(['first']);
  });
});
