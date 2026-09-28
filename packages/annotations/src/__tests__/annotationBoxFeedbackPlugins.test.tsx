// @vitest-environment jsdom
//
// @dnd-kit 0.5 moved the per-draggable `feedback` mode into per-entity plugin
// config. A stale top-level `feedback: 'none'` is silently ignored, so this test
// reads the config back from the real registered entities.
import './jsdom-polyfills'; // must be first
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { DragDropProvider } from '@dnd-kit/react';
import { DragDropManager, Feedback } from '@dnd-kit/dom';
import { AnnotationBox } from '../components/AnnotationBox';

afterEach(cleanup);

describe('AnnotationBox per-entity Feedback plugin config (@dnd-kit 0.5)', () => {
  it('registers both edge handles with feedback: "none"', () => {
    const manager = new DragDropManager();
    render(
      <DragDropProvider manager={manager}>
        <AnnotationBox annotationId="a1" annotationIndex={3} startPosition={10} endPosition={50} />
      </DragDropProvider>
    );
    const start = manager.registry.draggables.get('annotation-boundary-start-3');
    const end = manager.registry.draggables.get('annotation-boundary-end-3');
    expect(start).toBeDefined();
    expect(end).toBeDefined();
    expect(start!.pluginConfig(Feedback)?.feedback).toBe('none');
    expect(end!.pluginConfig(Feedback)?.feedback).toBe('none');
  });
});
