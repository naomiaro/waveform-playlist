// @vitest-environment jsdom
//
// #815: the list's m:ss.mmm times round once, as a whole, so a time just
// under a minute carries into the minutes instead of printing 60 seconds.
// The same formatter is handed to a custom row as `formatTime`.
import './jsdom-polyfills'; // must be first
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import type { AnnotationData } from '@waveform-playlist/core';
import { AnnotationText } from '../components/AnnotationText';

afterEach(cleanup);

const one = (start: number, end: number): AnnotationData[] => [
  { id: 'a', start, end, lines: ['text'] },
];

describe('AnnotationText times (#815)', () => {
  it('carries a time just under a minute into the next minute', () => {
    const { container } = render(<AnnotationText annotations={one(59.9996, 119.9999)} />);
    expect(container.textContent).toContain('1:00.000 - 2:00.000');
    expect(container.textContent).not.toContain(':60');
  });

  it('keeps a time just under the rounding point in its minute', () => {
    const { container } = render(<AnnotationText annotations={one(59.9994, 61.25)} />);
    expect(container.textContent).toContain('0:59.999 - 1:01.250');
  });

  it('prints a negative time as zero', () => {
    const { container } = render(<AnnotationText annotations={one(-0.5, 1)} />);
    expect(container.textContent).toContain('0:00.000 - 0:01.000');
  });

  it('prints digits, never exponent notation, for a time of 1e21 s or more', () => {
    const { container } = render(<AnnotationText annotations={one(1.08e21, 1.08e21)} />);
    expect(container.textContent).toMatch(/\d+:\d{2}\.\d{3} - \d+:\d{2}\.\d{3}/);
    expect(container.textContent).not.toContain('e+');
  });

  it('hands the same formatter to a custom row', () => {
    const renderItem = vi.fn(({ formatTime }) => <span>{formatTime(59.9996)}</span>);
    const { container } = render(
      <AnnotationText annotations={one(0, 1)} renderAnnotationItem={renderItem} />
    );
    expect(container.textContent).toBe('1:00.000');
  });
});
