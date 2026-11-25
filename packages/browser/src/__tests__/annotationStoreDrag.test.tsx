// @vitest-environment jsdom
//
// The annotation boxes on a store that starts empty: the first annotation the
// app adds is drawn, and its edge can be dragged (#867).
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import React from 'react';
import type { DragStartEvent, DragMoveEvent, DragEndEvent } from '@dnd-kit/abstract';

const dragProviderProps = vi.hoisted(
  () =>
    [] as {
      onDragStart?: (event: unknown) => void;
      onDragMove?: (event: unknown) => void;
      onDragEnd?: (event: unknown) => void;
    }[]
);

vi.mock('@dnd-kit/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/react')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    DragDropProvider: (props: React.ComponentProps<typeof actual.DragDropProvider>) => {
      dragProviderProps.push(props as (typeof dragProviderProps)[number]);
      return createElement(actual.DragDropProvider, props);
    },
  };
});

import { createAnnotationStore } from '@waveform-playlist/core';
import type { AnnotationData } from '@waveform-playlist/core';
import { TestProvider, adapterFactory } from './helpers/arrangementProvider';
import {
  AnnotationIntegrationContext,
  type AnnotationIntegration,
  type AnnotationBoxIntegrationProps,
  type AnnotationBoxesWrapperIntegrationProps,
} from '../AnnotationIntegrationContext';
import { WaveformAnnotationBoxes } from '../components/WaveformAnnotationBoxes';
import { WaveformExtentContext } from '../components/waveformLayoutContext';

// 1 px = 0.01 s
const SAMPLE_RATE = 1000;
const SAMPLES_PER_PIXEL = 10;

const FakeBox: React.FC<AnnotationBoxIntegrationProps> = (props) => (
  <button data-box={props.annotationId} />
);
const FakeWrapper: React.FC<AnnotationBoxesWrapperIntegrationProps> = (props) => (
  <div>{props.children}</div>
);
const INTEGRATION = {
  AnnotationBox: FakeBox,
  AnnotationBoxesWrapper: FakeWrapper,
  AnnotationText: () => null,
} as unknown as AnnotationIntegration;

const dragSource = { data: { annotationId: 'a', annotationIndex: 0, edge: 'end' as const } };

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  dragProviderProps.length = 0;
  vi.restoreAllMocks();
});

describe('WaveformAnnotationBoxes on a store that starts empty', () => {
  it('draws the first annotation the app adds, and its edge can be dragged', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const store = createAnnotationStore();
    const { container } = render(
      <AnnotationIntegrationContext value={INTEGRATION}>
        <TestProvider
          sampleRate={SAMPLE_RATE}
          samplesPerPixel={SAMPLES_PER_PIXEL}
          zoomLevels={[SAMPLES_PER_PIXEL]}
          createAdapter={adapterFactory(SAMPLE_RATE).createAdapter}
          annotationStore={store}
          annotationList={{ editable: true }}
        >
          <WaveformExtentContext value={{ displayDuration: 60, tracksFullWidth: 6000 }}>
            <WaveformAnnotationBoxes />
          </WaveformExtentContext>
        </TestProvider>
      </AnnotationIntegrationContext>
    );
    expect(container.querySelectorAll('[data-box]').length).toBe(0);

    const first: AnnotationData = { id: 'a', start: 1, end: 2, lines: ['a'] };
    await act(async () => {
      store.update((c) => [...c, first]);
    });
    expect(container.querySelectorAll('[data-box="a"]').length).toBe(1);

    const handlers = dragProviderProps[dragProviderProps.length - 1];
    act(() => {
      handlers.onDragStart?.({ operation: { source: dragSource } } as unknown as DragStartEvent);
    });
    act(() => {
      handlers.onDragMove?.({
        operation: {
          source: dragSource,
          position: { initial: { x: 100 }, current: { x: 100 } },
        },
        to: { x: 150, y: 0 },
      } as unknown as DragMoveEvent);
    });
    act(() => {
      handlers.onDragEnd?.({ canceled: false } as unknown as DragEndEvent);
    });

    expect(store.getAnnotations()[0].end).toBeCloseTo(2.5, 5);
  });

  it('a release through the boxes keeps an annotation the app added during the drag', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const store = createAnnotationStore([{ id: 'a', start: 1, end: 2, lines: ['a'] }]);
    render(
      <AnnotationIntegrationContext value={INTEGRATION}>
        <TestProvider
          sampleRate={SAMPLE_RATE}
          samplesPerPixel={SAMPLES_PER_PIXEL}
          zoomLevels={[SAMPLES_PER_PIXEL]}
          createAdapter={adapterFactory(SAMPLE_RATE).createAdapter}
          annotationStore={store}
          annotationList={{ editable: true }}
        >
          <WaveformExtentContext value={{ displayDuration: 60, tracksFullWidth: 6000 }}>
            <WaveformAnnotationBoxes />
          </WaveformExtentContext>
        </TestProvider>
      </AnnotationIntegrationContext>
    );
    const handlers = dragProviderProps[dragProviderProps.length - 1];
    act(() => {
      handlers.onDragStart?.({ operation: { source: dragSource } } as unknown as DragStartEvent);
    });
    act(() => {
      handlers.onDragMove?.({
        operation: {
          source: dragSource,
          position: { initial: { x: 100 }, current: { x: 100 } },
        },
        to: { x: 150, y: 0 },
      } as unknown as DragMoveEvent);
    });
    await act(async () => {
      store.update((c) => [...c, { id: 'x', start: 8, end: 9, lines: ['x'] }]);
    });
    act(() => {
      handlers.onDragEnd?.({ canceled: false } as unknown as DragEndEvent);
    });

    expect(store.getAnnotations().map((a) => a.id)).toEqual(['a', 'x']);
    expect(store.getAnnotations()[0].end).toBeCloseTo(2.5, 5);
  });
});
