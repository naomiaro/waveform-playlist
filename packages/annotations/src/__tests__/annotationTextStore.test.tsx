// @vitest-environment jsdom
//
// AnnotationText with a store (#867): every edit finds its row by id in the
// store's list as it is when the edit is made, and a field whose edit was not
// stored shows the stored value again.
import './jsdom-polyfills'; // must be first
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createAnnotationStore } from '@waveform-playlist/core';
import type { AnnotationAction, AnnotationData, AnnotationStore } from '@waveform-playlist/core';
import { AnnotationText } from '../components/AnnotationText';

const list = (): AnnotationData[] => [
  { id: 'a', start: 0, end: 1, lines: ['first'] },
  { id: 'b', start: 1, end: 2, lines: ['second'] },
];
const inserted: AnnotationData = { id: 'x', start: 5, end: 6, lines: ['inserted'] };

afterEach(() => cleanup());

function renderList(
  store: AnnotationStore,
  props: Partial<React.ComponentProps<typeof AnnotationText>> = {}
) {
  return render(<AnnotationText annotations={list()} editable store={store} {...props} />);
}

describe('AnnotationText with a store', () => {
  it('a text edit lands on its annotation by id after an insert before it', () => {
    const store = createAnnotationStore(list());
    const { getByText } = renderList(store);
    const field = getByText('second');
    act(() => {
      store.update((c) => [inserted, ...c]);
      field.textContent = 'edited';
      fireEvent.blur(field);
    });
    const byId = Object.fromEntries(store.getAnnotations().map((a) => [a.id, a.lines]));
    expect(byId).toEqual({ x: ['inserted'], a: ['first'], b: ['edited'] });
  });

  it('an id edit to a duplicate writes nothing and the field shows the stored id', () => {
    const store = createAnnotationStore(list());
    const before = store.getAnnotations();
    const { getByText } = renderList(store);
    const label = getByText('b');
    label.textContent = 'a';
    fireEvent.blur(label);
    expect(store.getAnnotations()).toBe(before);
    expect(label.textContent).toBe('b');
  });

  it('an empty id writes nothing and the field shows the stored id', () => {
    const store = createAnnotationStore(list());
    const before = store.getAnnotations();
    const { getByText } = renderList(store);
    const label = getByText('b');
    label.textContent = '   ';
    fireEvent.blur(label);
    expect(store.getAnnotations()).toBe(before);
    expect(label.textContent).toBe('b');
  });

  it('an id edit renames its annotation', () => {
    const store = createAnnotationStore(list());
    const { getByText } = renderList(store);
    const label = getByText('b');
    label.textContent = ' b2 ';
    fireEvent.blur(label);
    expect(store.getAnnotations().map((a) => a.id)).toEqual(['a', 'b2']);
  });

  it('a text edit that beforeChange refuses leaves the field showing the stored text', () => {
    const store = createAnnotationStore(list(), { beforeChange: (_next, current) => current });
    const { getByText } = renderList(store);
    const field = getByText('second');
    field.textContent = 'refused';
    fireEvent.blur(field);
    expect(store.getAnnotations()[1].lines).toEqual(['second']);
    expect(field.textContent).toBe('second');
  });

  it('a control click lands on its annotation by id', () => {
    const store = createAnnotationStore(list());
    const remove: AnnotationAction = {
      text: 'del',
      title: 'Delete',
      action: (_annotation, i, annotations) => {
        annotations.splice(i, 1);
      },
    };
    const { getAllByTitle } = renderList(store, { controls: [remove] });
    const secondRowButton = getAllByTitle('Delete')[1];
    act(() => {
      store.update((c) => [inserted, ...c]);
      fireEvent.click(secondRowButton);
    });
    expect(store.getAnnotations().map((a) => a.id)).toEqual(['x', 'a']);
  });
});

describe('AnnotationText with nowhere to write', () => {
  it('draws no editable field and no control, whatever editable says', () => {
    const control: AnnotationAction = { text: 'go', title: 'Go', action: vi.fn() };
    const { container, queryAllByTitle } = render(
      <AnnotationText annotations={list()} editable controls={[control]} />
    );
    expect(container.querySelectorAll('[contenteditable="true"]').length).toBe(0);
    expect(queryAllByTitle('Go').length).toBe(0);
  });
});
