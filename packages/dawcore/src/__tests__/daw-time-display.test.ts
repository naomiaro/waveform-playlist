import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../index';
import type { DawTimeDisplayElement } from '../elements/daw-time-display';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));

function dispatchFrom(target: HTMLElement, type: string, detail: unknown) {
  target.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
}

describe('daw-time-display', () => {
  let fakeEditor: HTMLElement;
  let display: DawTimeDisplayElement;

  beforeEach(async () => {
    fakeEditor = document.createElement('div');
    fakeEditor.id = 'fake-ed';
    Object.assign(fakeEditor, { currentTime: 12.5, timeFormat: 'hh:mm:ss.sss' });
    document.body.appendChild(fakeEditor);
    document.body.insertAdjacentHTML(
      'beforeend',
      '<daw-transport for="fake-ed"><daw-time-display></daw-time-display></daw-transport>'
    );
    display = document.querySelector('daw-time-display') as DawTimeDisplayElement;
    await nextFrame();
    await display.updateComplete;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('has status role and aria attributes per the accessibility spec', () => {
    const span = display.shadowRoot!.querySelector('span')!;
    expect(span.getAttribute('role')).toBe('status');
    expect(span.getAttribute('aria-label')).toBe('Playback time');
    expect(span.getAttribute('aria-live')).toBe('off');
  });

  it('renders the target currentTime in the target timeFormat initially', () => {
    expect(display.shadowRoot!.textContent).toContain('00:00:12.500');
  });

  it('updates on daw-timeupdate events from the target', async () => {
    dispatchFrom(fakeEditor, 'daw-timeupdate', { time: 65.25 });
    await display.updateComplete;
    expect(display.shadowRoot!.textContent).toContain('00:01:05.250');
  });

  it('ignores daw-timeupdate events from other elements', async () => {
    const other = document.createElement('div');
    document.body.appendChild(other);
    dispatchFrom(other, 'daw-timeupdate', { time: 99 });
    await display.updateComplete;
    expect(display.shadowRoot!.textContent).toContain('00:00:12.500');
  });

  it('re-formats on daw-time-format-change from the target', async () => {
    dispatchFrom(fakeEditor, 'daw-time-format-change', { format: 'seconds' });
    await display.updateComplete;
    expect(display.shadowRoot!.textContent).toContain('12.500');
  });
});

describe('daw-time-display without a target', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders a placeholder and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const display = document.createElement('daw-time-display') as DawTimeDisplayElement;
    document.body.appendChild(display);
    await nextFrame();
    await display.updateComplete;
    expect(display.shadowRoot!.textContent).toContain('--:--:--');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('re-syncs timeFormat from the target on late recovery', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.insertAdjacentHTML(
      'beforeend',
      '<daw-transport for="late-ed"><daw-time-display></daw-time-display></daw-transport>'
    );
    const display = document.querySelector('daw-time-display') as DawTimeDisplayElement;
    await nextFrame();
    await display.updateComplete;
    expect(display.shadowRoot!.textContent).toContain('--:--:--');

    const late = document.createElement('div');
    late.id = 'late-ed';
    Object.assign(late, { currentTime: 0, timeFormat: 'seconds' });
    document.body.appendChild(late);
    dispatchFrom(late, 'daw-timeupdate', { time: 3.5 });
    await display.updateComplete;
    expect(display.shadowRoot!.textContent).toContain('3.500');
    expect(display.shadowRoot!.textContent).not.toContain('00:00:03.500');
  });

  it('does not warn when removed before the deferred initial sync', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const display = document.createElement('daw-time-display') as DawTimeDisplayElement;
    document.body.appendChild(display);
    display.remove();
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    expect(warn).not.toHaveBeenCalled();
  });
});
