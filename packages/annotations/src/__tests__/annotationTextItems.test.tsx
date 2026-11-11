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

beforeEach(() => {
  scrolled = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this.textContent ?? '');
  };
});

afterEach(cleanup);

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
});
