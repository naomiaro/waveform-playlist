// @vitest-environment jsdom
//
// Track width changes on every zoom step and grows while recording, so it must be
// an inline style: interpolated in a styled-components template it generates one
// CSS class per distinct value.
import './jsdom-polyfills'; // must be first
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { AnnotationBoxesWrapper as Component } from '../components/AnnotationBoxesWrapper';

afterEach(cleanup);

describe('AnnotationBoxesWrapper width', () => {
  it('is an inline style, so a new width reuses the same CSS class', () => {
    const { container, rerender } = render(<Component width={1000} />);
    const el = container.firstElementChild as HTMLElement;
    const classBefore = el.className;
    expect(el.style.width).toBe('1000px');

    rerender(<Component width={1001} />);
    expect(el.style.width).toBe('1001px');
    expect(el.className).toBe(classBefore);
  });

  it('sets no width when the prop is omitted', () => {
    const { container } = render(<Component />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.width).toBe('');
  });
});
