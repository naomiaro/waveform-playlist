// @vitest-environment jsdom
//
// No component has a fixed element id: two of one control on a page (two
// players) must not share an id, or a label reaches the other one's input.
import './jsdom-polyfills'; // must be first
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { AutomaticScrollCheckbox } from '../components/AutomaticScrollCheckbox';
import { MasterVolumeControl } from '../components/MasterVolumeControl';
import { SelectionTimeInputs } from '../components/SelectionTimeInputs';

afterEach(cleanup);

const idsOf = (container: HTMLElement) =>
  [...container.querySelectorAll('input')].map((input) => input.id);

describe('generated element ids', () => {
  it('AutomaticScrollCheckbox: two do not share an id, and each label ticks its own box', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { container, getAllByText } = render(
      <>
        <AutomaticScrollCheckbox checked={false} onChange={first} />
        <AutomaticScrollCheckbox checked={false} onChange={second} />
      </>
    );
    const ids = idsOf(container);
    expect(ids).toHaveLength(2);
    expect(ids.every((id) => id !== '')).toBe(true);
    expect(new Set(ids).size).toBe(2);
    fireEvent.click(getAllByText('Automatic Scroll')[1]);
    expect(second).toHaveBeenCalledWith(true);
    expect(first).not.toHaveBeenCalled();
    // The class of the input is unchanged.
    expect(container.querySelectorAll('input.automatic-scroll')).toHaveLength(2);
  });

  it('MasterVolumeControl: two do not share an id, and each label names its own slider', () => {
    const { container, getAllByLabelText } = render(
      <>
        <MasterVolumeControl volume={0.25} onChange={() => {}} />
        <MasterVolumeControl volume={0.75} onChange={() => {}} />
      </>
    );
    const ids = idsOf(container);
    expect(ids).toHaveLength(2);
    expect(ids.every((id) => id !== '')).toBe(true);
    expect(new Set(ids).size).toBe(2);
    const sliders = getAllByLabelText('Master Volume') as HTMLInputElement[];
    expect(sliders.map((slider) => slider.value)).toEqual(['25', '75']);
  });

  it('SelectionTimeInputs: four inputs of two components have four ids, each with its own label', () => {
    const { container, getAllByLabelText } = render(
      <>
        <SelectionTimeInputs selectionStart={1} selectionEnd={2} />
        <SelectionTimeInputs selectionStart={3} selectionEnd={4} />
      </>
    );
    const ids = idsOf(container);
    expect(ids).toHaveLength(4);
    expect(ids.every((id) => id !== '')).toBe(true);
    expect(new Set(ids).size).toBe(4);
    const starts = getAllByLabelText('Start of audio selection') as HTMLInputElement[];
    const ends = getAllByLabelText('End of audio selection') as HTMLInputElement[];
    expect(starts.map((input) => input.value)).toEqual(['00:00:01.000', '00:00:03.000']);
    expect(ends.map((input) => input.value)).toEqual(['00:00:02.000', '00:00:04.000']);
    // The classes of the inputs are unchanged.
    expect(container.querySelectorAll('input.audio-start')).toHaveLength(2);
    expect(container.querySelectorAll('input.audio-end')).toHaveLength(2);
  });
});
