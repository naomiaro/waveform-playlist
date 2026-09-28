// @dnd-kit 0.5 moved the per-draggable `feedback` mode out of the hook
// options and into per-entity plugin config (`plugins: [Feedback.configure()]`).
// A stale top-level `feedback: 'none'` is silently ignored at runtime, so these
// tests read the config back from the REAL registered entities — the only
// place the Feedback plugin itself looks (`source.pluginConfig(Feedback)`).
import './jsdom-polyfills'; // must be first
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { DragDropProvider } from '@dnd-kit/react';
import { DragDropManager, Feedback } from '@dnd-kit/dom';
import { Clip } from '../components/Clip';

afterEach(cleanup);

function mountClip() {
  const manager = new DragDropManager();
  render(
    <DragDropProvider manager={manager}>
      <Clip
        clipId="c1"
        trackIndex={0}
        clipIndex={0}
        trackName="Track 1"
        startSample={0}
        durationSamples={48000}
        samplesPerPixel={100}
        showHeader
      />
    </DragDropProvider>
  );
  return manager;
}

describe('Clip per-entity Feedback plugin config (@dnd-kit 0.5)', () => {
  it('registers both trim handles with feedback: "none"', () => {
    const manager = mountClip();
    const left = manager.registry.draggables.get('clip-boundary-left-0-0');
    const right = manager.registry.draggables.get('clip-boundary-right-0-0');
    expect(left).toBeDefined();
    expect(right).toBeDefined();
    expect(left!.pluginConfig(Feedback)?.feedback).toBe('none');
    expect(right!.pluginConfig(Feedback)?.feedback).toBe('none');
  });

  it('registers the clip-move draggable with dropAnimation: null', () => {
    const manager = mountClip();
    const move = manager.registry.draggables.get('clip-0-0');
    expect(move).toBeDefined();
    expect(move!.pluginConfig(Feedback)?.dropAnimation).toBeNull();
  });
});
