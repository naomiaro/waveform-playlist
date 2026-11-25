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

const Shortcuts: React.FC<{ label: string }> = ({ label }) => {
  useKeyboardShortcuts({
    shortcuts: [{ key: ' ', action: () => seen.push(label), description: 'record the label' }],
  });
  return null;
};

/** Presses Space from a layout effect: after the commit, before passive effects. */
const PressInLayoutEffect: React.FC<{ label: string }> = ({ label }) => {
  useLayoutEffect(() => {
    if (label === 'first') return;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  }, [label]);
  return null;
};

let setLabel: (label: string) => void = () => {};

const Harness: React.FC = () => {
  const [label, set] = useState('first');
  setLabel = set;
  return (
    <>
      <Shortcuts label={label} />
      <PressInLayoutEffect label={label} />
    </>
  );
};

afterEach(() => {
  cleanup();
  seen.length = 0;
});

describe('useKeyboardShortcuts', () => {
  it('runs the handlers of the commit a key press follows, before its passive effects', () => {
    render(<Harness />);
    act(() => {
      setLabel('second');
    });
    expect(seen).toEqual(['second']);
  });
});
