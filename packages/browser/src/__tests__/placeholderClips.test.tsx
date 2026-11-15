// @vitest-environment jsdom
//
// #812: a clip whose audio is not loaded yet is drawn as a placeholder and
// nothing may edit it: no trim handles, and its header does not start a drag.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DragDropProvider } from '@dnd-kit/react';
import { Clip } from '@waveform-playlist/ui-components';

afterEach(cleanup);

function row(isPlaceholder: boolean) {
  return render(
    <DragDropProvider>
      <Clip
        clipId="c1"
        trackIndex={0}
        clipIndex={0}
        trackName="Vocals"
        startSample={0}
        durationSamples={48000}
        samplesPerPixel={500}
        showHeader
        isPlaceholder={isPlaceholder}
      />
    </DragDropProvider>
  );
}

describe('a placeholder row', () => {
  it('a placeholder row has no trim handles and its header does not start a drag', () => {
    const { container } = row(true);
    expect(container.querySelectorAll('[data-boundary-edge]')).toHaveLength(0);
    expect(container.querySelector('[data-clip-id]')).toBeNull();
    expect(container.querySelector('[aria-roledescription="draggable"]')).toBeNull();
    expect(
      container.querySelector('[data-clip-container]')?.getAttribute('data-clip-placeholder')
    ).toBe('true');
  });

  it('a loaded clip has both handles and a header that drags (the control)', () => {
    const { container } = row(false);
    expect(container.querySelectorAll('[data-boundary-edge]')).toHaveLength(2);
    expect(container.querySelector('[data-clip-id="c1"]')).not.toBeNull();
    expect(container.querySelector('[data-clip-placeholder]')).toBeNull();
  });
});
