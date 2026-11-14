// `isPlaceholder` marks the clip's container for a clip whose audio is not
// loaded (#812) and switches nothing else.
import './jsdom-polyfills'; // must be first
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { DragDropProvider } from '@dnd-kit/react';
import { DragDropManager } from '@dnd-kit/dom';
import { Clip } from '../components/Clip';

afterEach(cleanup);

function mountClip(isPlaceholder?: boolean) {
  const manager = new DragDropManager();
  const { container } = render(
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
        isPlaceholder={isPlaceholder}
      />
    </DragDropProvider>
  );
  return { container, manager };
}

describe('Clip isPlaceholder', () => {
  it('puts data-clip-placeholder="true" on the container', () => {
    const { container } = mountClip(true);
    const clip = container.querySelector('[data-clip-container]');
    expect(clip?.getAttribute('data-clip-placeholder')).toBe('true');
  });

  it('leaves the attribute out by default', () => {
    const { container } = mountClip();
    const clip = container.querySelector('[data-clip-container]');
    expect(clip).not.toBeNull();
    expect(clip!.hasAttribute('data-clip-placeholder')).toBe(false);
  });

  it('switches nothing else: the trim handles and the move draggable stay enabled', () => {
    const { container, manager } = mountClip(true);
    expect(container.querySelectorAll('[data-boundary-edge]')).toHaveLength(2);
    expect(manager.registry.draggables.get('clip-0-0')?.disabled).toBe(false);
  });
});
