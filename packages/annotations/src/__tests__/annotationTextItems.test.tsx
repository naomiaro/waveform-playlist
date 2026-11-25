// @vitest-environment jsdom
//
// #740: the active annotation changes at every annotation boundary during
// playback. Only the item that stops being active and the one that becomes
// active may re-render; the others keep their props.
import './jsdom-polyfills'; // must be first
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createAnnotationStore } from '@waveform-playlist/core';
import type { AnnotationData } from '@waveform-playlist/core';

/** A store of `list`, and a spy told after each change of it. */
function spyStore(list: readonly AnnotationData[]) {
  const store = createAnnotationStore(list);
  const changes = vi.fn();
  store.subscribe(changes);
  return { store, changes };
}
import { AnnotationText } from '../components/AnnotationText';

const ANNOTATIONS: AnnotationData[] = [
  { id: 'a', start: 0, end: 1, lines: ['first'] },
  { id: 'b', start: 1, end: 2, lines: ['second'] },
  { id: 'c', start: 2, end: 3, lines: ['third'] },
  { id: 'd', start: 3, end: 4, lines: ['fourth'] },
];

let scrolled: string[];
let originalScrollIntoView: typeof Element.prototype.scrollIntoView;

beforeEach(() => {
  scrolled = [];
  originalScrollIntoView = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this.textContent ?? '');
  };
});

afterEach(() => {
  cleanup();
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

describe('AnnotationText items (#740)', () => {
  it('an active-annotation change renders the two items involved and no other', () => {
    const calls: Record<string, number> = {};
    const renderItem = vi.fn(({ annotation, isActive }) => {
      calls[annotation.id] = (calls[annotation.id] ?? 0) + 1;
      return <span data-active={isActive}>{annotation.id}</span>;
    });
    const { store } = spyStore(ANNOTATIONS);
    const ui = (activeId: string) => (
      <AnnotationText
        annotations={ANNOTATIONS}
        activeAnnotationId={activeId}
        store={store}
        renderAnnotationItem={renderItem}
      />
    );
    const { rerender } = render(ui('a'));
    expect(Object.keys(calls).sort()).toEqual(['a', 'b', 'c', 'd']);
    for (const id of Object.keys(calls)) delete calls[id];

    rerender(ui('b'));

    expect(Object.keys(calls).sort()).toEqual(['a', 'b']);
    const last = (id: string) =>
      renderItem.mock.calls.filter(([props]) => props.annotation.id === id).pop()?.[0];
    expect(last('a')?.isActive).toBe(false);
    expect(last('b')?.isActive).toBe(true);
  });

  // Each move of an edge drag replaces one or two annotation objects in a new
  // array. The edit and control handlers every row receives used to be
  // rebuilt from that array, which re-rendered all rows.
  it('a change to one annotation renders that item and no other', () => {
    const calls: Record<string, number> = {};
    const renderItem = vi.fn(({ annotation }) => {
      calls[annotation.id] = (calls[annotation.id] ?? 0) + 1;
      return <span>{annotation.id}</span>;
    });
    const { store } = spyStore(ANNOTATIONS);
    const controls = [{ title: 'x', action: vi.fn() }];
    const ui = (annotations: AnnotationData[]) => (
      <AnnotationText
        annotations={annotations}
        activeAnnotationId="a"
        editable
        controls={controls}
        store={store}
        renderAnnotationItem={renderItem}
      />
    );
    const { rerender } = render(ui(ANNOTATIONS));
    for (const id of Object.keys(calls)) delete calls[id];

    rerender(ui(ANNOTATIONS.map((a) => (a.id === 'c' ? { ...a, end: 2.5 } : a))));

    expect(Object.keys(calls)).toEqual(['c']);
  });

  it('the default items mark the active one and scroll to it', () => {
    const ui = (activeId: string) => (
      <AnnotationText
        annotations={ANNOTATIONS}
        activeAnnotationId={activeId}
        shouldScrollToActive
      />
    );
    const { rerender } = render(ui('a'));
    expect(scrolled[scrolled.length - 1]).toContain('first');

    rerender(ui('c'));

    expect(scrolled[scrolled.length - 1]).toContain('third');
    expect(scrolled[scrolled.length - 1]).not.toContain('first');
  });

  it('a custom item passes clicks through with its annotation', () => {
    const onClick = vi.fn();
    const { getByText } = render(
      <AnnotationText
        annotations={ANNOTATIONS}
        onAnnotationClick={onClick}
        renderAnnotationItem={({ annotation, onClick: click }) => (
          <button onClick={click}>{annotation.id}</button>
        )}
      />
    );

    fireEvent.click(getByText('c'));

    expect(onClick).toHaveBeenCalledWith(ANNOTATIONS[2]);
  });

  it("an edit made after the annotations changed is applied to the store's current list", () => {
    const { store, changes } = spyStore(ANNOTATIONS);
    const ui = (annotations: AnnotationData[], activeId: string) => (
      <AnnotationText
        annotations={annotations}
        activeAnnotationId={activeId}
        editable
        store={store}
      />
    );
    const { rerender, getByText } = render(ui(ANNOTATIONS, 'a'));
    const moved = ANNOTATIONS.map((a) => (a.id === 'd' ? { ...a, end: 9 } : a));
    store.set(moved);
    changes.mockClear();
    // Item `b` keeps its props across this render and the next; its handlers
    // must still see the list that has the moved `d`.
    rerender(ui(moved, 'a'));
    rerender(ui(moved, 'c'));

    const text = getByText('second');
    text.textContent = 'second, edited';
    fireEvent.blur(text);

    expect(changes).toHaveBeenCalledTimes(1);
    const updated = store.getAnnotations();
    expect(updated[1].lines).toEqual(['second, edited']);
    expect(updated[3].end).toBe(9);
  });

  it("a control acts on the store's current list and the current options", () => {
    const { store, changes } = spyStore(ANNOTATIONS);
    const action = vi.fn();
    const controls = [{ text: 'X', title: 'act', action }];
    const ui = (annotations: AnnotationData[], linkEndpoints: boolean) => (
      <AnnotationText
        annotations={annotations}
        editable
        controls={controls}
        annotationListConfig={{ linkEndpoints }}
        store={store}
      />
    );
    const { rerender, getAllByTitle } = render(ui(ANNOTATIONS, false));
    const moved = ANNOTATIONS.map((a) => (a.id === 'd' ? { ...a, end: 9 } : a));
    store.set(moved);
    changes.mockClear();
    rerender(ui(moved, true));

    fireEvent.click(getAllByTitle('act')[1]);

    expect(action).toHaveBeenCalledTimes(1);
    const [annotation, index, list, options] = action.mock.calls[0];
    expect(annotation.id).toBe('b');
    expect(index).toBe(1);
    expect(list[3].end).toBe(9);
    expect(options).toEqual({ linkEndpoints: true });
    // The action changed nothing, so nothing is stored.
    expect(changes).not.toHaveBeenCalled();
  });

  it('a control sees new options when only the options change', () => {
    const { store } = spyStore(ANNOTATIONS);
    const action = vi.fn();
    const controls = [{ text: 'X', title: 'act', action }];
    const ui = (linkEndpoints: boolean) => (
      <AnnotationText
        annotations={ANNOTATIONS}
        editable
        controls={controls}
        annotationListConfig={{ linkEndpoints }}
        store={store}
      />
    );
    const { rerender, getAllByTitle } = render(ui(false));
    rerender(ui(true));

    fireEvent.click(getAllByTitle('act')[0]);

    expect(action.mock.calls[0][3]).toEqual({ linkEndpoints: true });
  });

  it('an edit is ignored once the list stops being editable, and applied once it is again', () => {
    const { store, changes } = spyStore(ANNOTATIONS);
    const ui = (editable: boolean) => (
      <AnnotationText annotations={ANNOTATIONS} editable={editable} store={store} />
    );
    const { rerender, getByText } = render(ui(true));

    rerender(ui(false));
    const field = getByText('second');
    field.textContent = 'second, edited';
    fireEvent.blur(field);
    expect(changes).not.toHaveBeenCalled();

    rerender(ui(true));
    field.textContent = 'second, edited';
    fireEvent.blur(field);
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it('an edit goes to the store of the latest render', () => {
    const first = spyStore(ANNOTATIONS);
    const second = spyStore(ANNOTATIONS);
    const ui = (store: ReturnType<typeof spyStore>['store']) => (
      <AnnotationText annotations={ANNOTATIONS} editable store={store} />
    );
    const { rerender, getByText } = render(ui(first.store));
    rerender(ui(second.store));

    const field = getByText('third');
    field.textContent = 'third, edited';
    fireEvent.blur(field);

    expect(first.changes).not.toHaveBeenCalled();
    expect(second.changes).toHaveBeenCalledTimes(1);
  });

  it('an id edit renames that annotation in the current list, and an empty id is refused', () => {
    const { store, changes } = spyStore(ANNOTATIONS);
    const { getByText } = render(
      <AnnotationText annotations={ANNOTATIONS} editable store={store} />
    );

    const label = getByText('b');
    label.textContent = '   ';
    fireEvent.blur(label);
    expect(changes).not.toHaveBeenCalled();

    label.textContent = ' b2 ';
    fireEvent.blur(label);
    expect(store.getAnnotations().map((a) => a.id)).toEqual(['a', 'b2', 'c', 'd']);
  });
});
