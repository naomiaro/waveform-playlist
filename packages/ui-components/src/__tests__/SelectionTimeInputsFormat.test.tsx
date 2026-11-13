// @vitest-environment jsdom
//
// The selection inputs show the format they are given. They used to look in
// the page for the first element with the class `time-format` and follow its
// change events, so they ignored a format set from code, stayed on the default
// without such a select, and followed another player's select on a page with two.
import './jsdom-polyfills'; // must be first
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { SelectionTimeInputs } from '../components/SelectionTimeInputs';
import { formatTime } from '../utils/timeFormat';

afterEach(cleanup);

const values = (container: HTMLElement) =>
  [...container.querySelectorAll('input')].map((input) => input.value);

describe('SelectionTimeInputs format', () => {
  it('shows the times in the `format` it is given, and follows a change of it', () => {
    const { container, rerender } = render(
      <SelectionTimeInputs selectionStart={61.5} selectionEnd={62.25} format="seconds" />
    );
    expect(formatTime(61.5, 'seconds')).not.toBe(formatTime(61.5, 'hh:mm:ss.uuu'));
    expect(values(container)).toEqual([formatTime(61.5, 'seconds'), formatTime(62.25, 'seconds')]);
    rerender(<SelectionTimeInputs selectionStart={61.5} selectionEnd={62.25} format="hh:mm:ss" />);
    expect(values(container)).toEqual([
      formatTime(61.5, 'hh:mm:ss'),
      formatTime(62.25, 'hh:mm:ss'),
    ]);
  });

  it('defaults to hh:mm:ss.uuu', () => {
    const { container } = render(<SelectionTimeInputs selectionStart={1} selectionEnd={2} />);
    expect(values(container)).toEqual(['00:00:01.000', '00:00:02.000']);
  });

  it('does not read a `.time-format` select elsewhere on the page, at mount or on its change', () => {
    const { container, getByTestId } = render(
      <>
        <select className="time-format" data-testid="other" defaultValue="seconds">
          <option value="seconds">seconds</option>
          <option value="hh:mm:ss">hh:mm:ss</option>
        </select>
        <div data-testid="inputs">
          <SelectionTimeInputs selectionStart={1} selectionEnd={2} />
        </div>
      </>
    );
    const inputs = () => values(getByTestId('inputs'));
    expect(inputs()).toEqual(['00:00:01.000', '00:00:02.000']);
    fireEvent.change(getByTestId('other'), { target: { value: 'hh:mm:ss' } });
    expect(inputs()).toEqual(['00:00:01.000', '00:00:02.000']);
    expect(container.querySelectorAll('input')).toHaveLength(2);
  });

  it('an edit is parsed in the given format', () => {
    const changes: [number, number][] = [];
    const { container } = render(
      <SelectionTimeInputs
        selectionStart={1}
        selectionEnd={5}
        format="seconds"
        onSelectionChange={(start, end) => changes.push([start, end])}
      />
    );
    const start = container.querySelectorAll('input')[0];
    fireEvent.change(start, { target: { value: '3' } });
    fireEvent.blur(start);
    expect(changes).toEqual([[3, 5]]);
  });
});
