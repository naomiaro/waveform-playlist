// @vitest-environment jsdom
//
// #686: nothing on the annotation path is a fixed value. A click on a default
// row chooses the annotation (not while a field of it is being edited, not on
// an action button); the colour of the active row is a theme key; and the
// three checkboxes generate their ids, so two of one checkbox can share a page.
import './jsdom-polyfills'; // must be first
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { describe, it, expect, afterEach, vi } from 'vitest';
import type { AnnotationData } from '@waveform-playlist/core';
import { AnnotationText } from '../components/AnnotationText';
import { ContinuousPlayCheckbox } from '../components/ContinuousPlayCheckbox';
import { LinkEndpointsCheckbox } from '../components/LinkEndpointsCheckbox';
import { EditableCheckbox } from '../components/EditableCheckbox';

const ANNOTATIONS: AnnotationData[] = [
  { id: 'a', start: 0, end: 1, lines: ['first'] },
  { id: 'b', start: 1, end: 2, lines: ['second'] },
];

afterEach(() => {
  cleanup();
});

describe('a click on a default row of the list (#686)', () => {
  it('chooses the annotation', () => {
    const onClick = vi.fn();
    const { getByText } = render(
      <AnnotationText annotations={ANNOTATIONS} onAnnotationClick={onClick} />
    );
    fireEvent.click(getByText('second'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(ANNOTATIONS[1]);
    // The time range is part of the row too.
    fireEvent.click(getByText('0:00.000 - 0:01.000'));
    expect(onClick).toHaveBeenLastCalledWith(ANNOTATIONS[0]);
  });

  it('does not choose it from a field that is being edited', () => {
    const onClick = vi.fn();
    const { getByText } = render(
      <AnnotationText annotations={ANNOTATIONS} editable onAnnotationClick={onClick} />
    );
    fireEvent.click(getByText('second')); // the text field
    fireEvent.click(getByText('b')); // the id field
    expect(onClick).not.toHaveBeenCalled();
    // Outside the two fields the row still answers.
    fireEvent.click(getByText('0:01.000 - 0:02.000'));
    expect(onClick).toHaveBeenCalledWith(ANNOTATIONS[1]);
  });

  it('does not choose it from an action button', () => {
    const onClick = vi.fn();
    const action = vi.fn();
    const { getAllByTitle } = render(
      <AnnotationText
        annotations={ANNOTATIONS}
        editable
        controls={[{ text: 'x', title: 'Remove', action }]}
        onAnnotationClick={onClick}
        onAnnotationUpdate={() => {}}
      />
    );
    fireEvent.click(getAllByTitle('Remove')[1]);
    expect(action).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('the colour of the active row (#686)', () => {
  const activeRow = (container: HTMLElement) =>
    container.querySelector('div > div > div') as HTMLElement;

  it('is #ff9800 without a theme', () => {
    const { container } = render(
      <AnnotationText annotations={ANNOTATIONS} activeAnnotationId="a" />
    );
    expect(getComputedStyle(activeRow(container)).borderLeftColor).toBe('rgb(255, 152, 0)');
  });

  it("is the theme's annotationTextItemActiveColor", () => {
    const { container } = render(
      <ThemeProvider theme={{ annotationTextItemActiveColor: 'rgb(1, 2, 3)' } as DefaultTheme}>
        <AnnotationText annotations={ANNOTATIONS} activeAnnotationId="a" />
      </ThemeProvider>
    );
    expect(getComputedStyle(activeRow(container)).borderLeftColor).toBe('rgb(1, 2, 3)');
  });
});

describe('the annotation checkboxes (#686)', () => {
  it('two of one checkbox do not share an id, and each label ticks its own box', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { container, getAllByText } = render(
      <>
        <ContinuousPlayCheckbox checked={false} onChange={first} />
        <ContinuousPlayCheckbox checked={false} onChange={second} />
      </>
    );
    const ids = [...container.querySelectorAll('input')].map((input) => input.id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe('');
    expect(new Set(ids).size).toBe(2);
    fireEvent.click(getAllByText('Continuous Play')[1]);
    expect(second).toHaveBeenCalledWith(true);
    expect(first).not.toHaveBeenCalled();
  });

  it.each([
    ['Continuous Play', ContinuousPlayCheckbox],
    ['Link Endpoints', LinkEndpointsCheckbox],
    ['Editable Annotations', EditableCheckbox],
  ] as const)('%s: the label belongs to the checkbox', (label, Checkbox) => {
    const onChange = vi.fn();
    const { getByLabelText } = render(<Checkbox checked={false} onChange={onChange} />);
    fireEvent.click(getByLabelText(label));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
