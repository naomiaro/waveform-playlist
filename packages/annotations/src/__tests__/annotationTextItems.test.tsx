// @vitest-environment jsdom
//
// #740: the active annotation changes at every annotation boundary during
// playback. Only the item that stops being active and the one that becomes
// active may re-render; the others keep their props.
import './jsdom-polyfills'; // must be first
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import type { AnnotationData } from '@waveform-playlist/core';
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
    const onUpdate = vi.fn();
    const ui = (activeId: string) => (
      <AnnotationText
        annotations={ANNOTATIONS}
        activeAnnotationId={activeId}
        onAnnotationUpdate={onUpdate}
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
    const onUpdate = vi.fn();
    const controls = [{ title: 'x', action: vi.fn() }];
    const ui = (annotations: AnnotationData[]) => (
      <AnnotationText
        annotations={annotations}
        activeAnnotationId="a"
        editable
        controls={controls}
        onAnnotationUpdate={onUpdate}
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

  it('an edit made after the annotations changed is applied to the current list', () => {
    const onUpdate = vi.fn();
    const ui = (annotations: AnnotationData[], activeId: string) => (
      <AnnotationText
        annotations={annotations}
        activeAnnotationId={activeId}
        editable
        onAnnotationUpdate={onUpdate}
      />
    );
    const { rerender, getByText } = render(ui(ANNOTATIONS, 'a'));
    const moved = ANNOTATIONS.map((a) => (a.id === 'd' ? { ...a, end: 9 } : a));
    // Item `b` keeps its props across this render and the next; its handlers
    // must still see the list that has the moved `d`.
    rerender(ui(moved, 'a'));
    rerender(ui(moved, 'c'));

    const text = getByText('second');
    text.textContent = 'second, edited';
    fireEvent.blur(text);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updated = onUpdate.mock.calls[0][0] as AnnotationData[];
    expect(updated[1].lines).toEqual(['second, edited']);
    expect(updated[3].end).toBe(9);
  });

  it('a control acts on the current list and the current options', () => {
    const onUpdate = vi.fn();
    const action = vi.fn();
    const controls = [{ text: 'X', title: 'act', action }];
    const ui = (annotations: AnnotationData[], linkEndpoints: boolean) => (
      <AnnotationText
        annotations={annotations}
        editable
        controls={controls}
        annotationListConfig={{ linkEndpoints }}
        onAnnotationUpdate={onUpdate}
      />
    );
    const { rerender, getAllByTitle } = render(ui(ANNOTATIONS, false));
    const moved = ANNOTATIONS.map((a) => (a.id === 'd' ? { ...a, end: 9 } : a));
    rerender(ui(moved, true));

    fireEvent.click(getAllByTitle('act')[1]);

    expect(action).toHaveBeenCalledTimes(1);
    const [annotation, index, list, options] = action.mock.calls[0];
    expect(annotation.id).toBe('b');
    expect(index).toBe(1);
    expect(list[3].end).toBe(9);
    expect(options).toEqual({ linkEndpoints: true });
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('a control sees new options when only the options change', () => {
    const onUpdate = vi.fn();
    const action = vi.fn();
    const controls = [{ text: 'X', title: 'act', action }];
    const ui = (linkEndpoints: boolean) => (
      <AnnotationText
        annotations={ANNOTATIONS}
        editable
        controls={controls}
        annotationListConfig={{ linkEndpoints }}
        onAnnotationUpdate={onUpdate}
      />
    );
    const { rerender, getAllByTitle } = render(ui(false));
    rerender(ui(true));

    fireEvent.click(getAllByTitle('act')[0]);

    expect(action.mock.calls[0][3]).toEqual({ linkEndpoints: true });
  });

  it('an edit is ignored once the list stops being editable, and applied once it is again', () => {
    const onUpdate = vi.fn();
    const ui = (editable: boolean) => (
      <AnnotationText annotations={ANNOTATIONS} editable={editable} onAnnotationUpdate={onUpdate} />
    );
    const { rerender, getByText } = render(ui(true));

    rerender(ui(false));
    fireEvent.blur(getByText('second'));
    expect(onUpdate).not.toHaveBeenCalled();

    rerender(ui(true));
    fireEvent.blur(getByText('second'));
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('an edit goes to the update callback of the latest render', () => {
    const first = vi.fn();
    const second = vi.fn();
    const ui = (onUpdate: (annotations: AnnotationData[]) => void) => (
      <AnnotationText annotations={ANNOTATIONS} editable onAnnotationUpdate={onUpdate} />
    );
    const { rerender, getByText } = render(ui(first));
    rerender(ui(second));

    fireEvent.blur(getByText('third'));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('an id edit renames that annotation in the current list, and an empty id is refused', () => {
    const onUpdate = vi.fn();
    const { getByText } = render(
      <AnnotationText annotations={ANNOTATIONS} editable onAnnotationUpdate={onUpdate} />
    );

    const label = getByText('b');
    label.textContent = '   ';
    fireEvent.blur(label);
    expect(onUpdate).not.toHaveBeenCalled();

    label.textContent = ' b2 ';
    fireEvent.blur(label);
    expect((onUpdate.mock.calls[0][0] as AnnotationData[]).map((a) => a.id)).toEqual([
      'a',
      'b2',
      'c',
      'd',
    ]);
  });
});
