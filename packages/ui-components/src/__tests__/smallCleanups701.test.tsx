// Small render-cost cleanups from #701: ClipBoundary hover, FadeOverlay path,
// TimeInput display value.
import React, { Profiler } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { ClipBoundary } from '../components/ClipBoundary';
import { FadeOverlay } from '../components/FadeOverlay';
import { TimeInput } from '../components/TimeInput';
import { defaultTheme } from '../wfpl-theme';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ClipBoundary hover', () => {
  it('is styled by CSS :hover alone, so hovering does not re-render', () => {
    let commits = 0;
    const { container } = render(
      <Profiler id="boundary" onRender={() => commits++}>
        <ClipBoundary
          clipId="clip-1"
          trackIndex={0}
          clipIndex={0}
          edge="left"
          dragHandleProps={{ ref: () => {}, isDragging: false }}
        />
      </Profiler>
    );
    const el = container.querySelector('[data-boundary-edge="left"]') as HTMLElement;
    const classBefore = el.className;
    const commitsBefore = commits;

    fireEvent.mouseEnter(el);
    expect(commits).toBe(commitsBefore);
    expect(el.className).toBe(classBefore);

    fireEvent.mouseLeave(el);
    expect(commits).toBe(commitsBefore);
  });

  it('still switches class while dragging', () => {
    const props = { clipId: 'clip-1', trackIndex: 0, clipIndex: 0, edge: 'right' as const };
    const ref = () => {};
    const { container, rerender } = render(
      <ClipBoundary {...props} dragHandleProps={{ ref, isDragging: false }} />
    );
    const el = container.querySelector('[data-boundary-edge="right"]') as HTMLElement;
    const classBefore = el.className;
    rerender(<ClipBoundary {...props} dragHandleProps={{ ref, isDragging: true }} />);
    expect(el.className).not.toBe(classBefore);
  });
});

describe('FadeOverlay path', () => {
  // FadeOverlay reads the theme, and styled-components' useTheme throws without a provider.
  const themed = (ui: React.ReactElement) => (
    <ThemeProvider theme={defaultTheme}>{ui}</ThemeProvider>
  );
  const pathOf = (container: HTMLElement) =>
    (container.querySelector('path') as SVGPathElement).getAttribute('d') as string;

  it('rounds coordinates to at most two decimals', () => {
    const { container } = render(themed(<FadeOverlay left={0} width={37} type="fadeIn" />));
    const numbers = pathOf(container).match(/-?\d+(\.\d+)?/g) as string[];
    expect(numbers.length).toBeGreaterThan(40);
    for (const n of numbers) {
      expect((n.split('.')[1] ?? '').length).toBeLessThanOrEqual(2);
    }
  });

  it('keeps the curve shape: starts fully covered, ends uncovered', () => {
    const { container } = render(
      themed(<FadeOverlay left={0} width={50} type="fadeIn" curveType="linear" />)
    );
    const d = pathOf(container);
    expect(d.startsWith('M 0,100 L 0,100 L ')).toBe(true);
    expect(d.endsWith(' L 50,0 L 50,0 L 0,0 Z')).toBe(true);
    // linear midpoint: 25 of 50 points -> x=25, y=50
    expect(d).toContain(' L 25,50 ');
  });

  it('does not recompute the path when re-rendered with the same width and curve', () => {
    const log10 = vi.spyOn(Math, 'log10');
    const { rerender } = render(themed(<FadeOverlay left={0} width={80} type="fadeIn" />));
    const callsAfterMount = log10.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThan(0);

    // left and colour change (a clip being dragged, a theme change); the path does not.
    rerender(themed(<FadeOverlay left={12} width={80} type="fadeIn" color="red" />));
    expect(log10.mock.calls.length).toBe(callsAfterMount);

    rerender(themed(<FadeOverlay left={12} width={81} type="fadeIn" color="red" />));
    expect(log10.mock.calls.length).toBeGreaterThan(callsAfterMount);
  });
});

describe('TimeInput', () => {
  const inputOf = (container: HTMLElement) => container.querySelector('input') as HTMLInputElement;

  it('shows the formatted value on the first render', () => {
    const html = renderToStaticMarkup(
      <TimeInput id="t" label="Start" value={65.5} format="hh:mm:ss.u" />
    );
    expect(html).toContain('value="00:01:05.5"');
  });

  it('renders once per value change', () => {
    let commits = 0;
    const ui = (value: number) => (
      <Profiler id="time" onRender={() => commits++}>
        <TimeInput id="t" label="Start" value={value} format="thousandths" />
      </Profiler>
    );
    const { container, rerender } = render(ui(1));
    expect(commits).toBe(1);
    rerender(ui(2));
    expect(commits).toBe(2);
    expect(inputOf(container).value).toBe('2.000');
  });

  it('follows a format change', () => {
    const { container, rerender } = render(
      <TimeInput id="t" label="Start" value={65} format="seconds" />
    );
    expect(inputOf(container).value).toBe('65');
    rerender(<TimeInput id="t" label="Start" value={65} format="hh:mm:ss" />);
    expect(inputOf(container).value).toBe('00:01:05');
  });

  it('keeps an in-progress edit and commits the parsed value on blur', () => {
    const onChange = vi.fn();
    const { container } = render(
      <TimeInput id="t" label="Start" value={1} format="thousandths" onChange={onChange} />
    );
    const input = inputOf(container);
    fireEvent.change(input, { target: { value: '2.5' } });
    expect(input.value).toBe('2.5');
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(2.5);
    // The parent did not accept the value, so the display returns to the prop.
    expect(input.value).toBe('1.000');
  });

  it('does not report a change when focus leaves without an edit', () => {
    // 1.23456 displays as "1.235"; tabbing through must not round the value.
    const onChange = vi.fn();
    const { container } = render(
      <TimeInput id="t" label="Start" value={1.23456} format="thousandths" onChange={onChange} />
    );
    fireEvent.blur(inputOf(container));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('blurs on Enter', () => {
    const { container } = render(<TimeInput id="t" label="Start" value={1} format="thousandths" />);
    const input = inputOf(container);
    input.focus();
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(document.activeElement).not.toBe(input);
  });
});
