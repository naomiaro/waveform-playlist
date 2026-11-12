// #688: the speed dropdown.
import React from 'react';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { PlaybackRateSelect, DEFAULT_PLAYBACK_RATES } from '../components/PlaybackRateSelect';
import { defaultTheme } from '../wfpl-theme';

afterEach(() => {
  cleanup();
});

const mount = (props: React.ComponentProps<typeof PlaybackRateSelect>) => {
  render(
    <ThemeProvider theme={defaultTheme}>
      <PlaybackRateSelect {...props} />
    </ThemeProvider>
  );
  return screen.getByRole('combobox', { name: 'Playback speed' }) as HTMLSelectElement;
};
const values = (select: HTMLSelectElement) => [...select.options].map((o) => o.value);
const labels = (select: HTMLSelectElement) => [...select.options].map((o) => o.textContent);

describe('PlaybackRateSelect', () => {
  it('lists the default speeds, labelled with a multiplication sign, and shows the current one', () => {
    const select = mount({ value: 1.25, onChange: () => {} });
    expect(values(select)).toEqual(DEFAULT_PLAYBACK_RATES.map(String));
    expect(labels(select)).toEqual(['0.5×', '0.75×', '1×', '1.25×', '1.5×', '2×']);
    expect(select.value).toBe('1.25');
  });

  it('reports the chosen speed as a number', () => {
    const onChange = vi.fn();
    const select = mount({ value: 1, onChange });
    fireEvent.change(select, { target: { value: '0.75' } });
    expect(onChange).toHaveBeenCalledWith(0.75);
  });

  it('lists the given speeds in the given order', () => {
    const select = mount({ value: 1, onChange: () => {}, rates: [2, 1, 0.5] });
    expect(values(select)).toEqual(['2', '1', '0.5']);
  });

  it('adds a current speed that is not among the rates, in ascending order, once', () => {
    const select = mount({ value: 0.9, onChange: () => {} });
    expect(values(select)).toEqual(['0.5', '0.75', '0.9', '1', '1.25', '1.5', '2']);
    expect(select.value).toBe('0.9');
  });

  it('can be disabled', () => {
    expect(mount({ value: 1, onChange: () => {}, disabled: true }).disabled).toBe(true);
  });
});
