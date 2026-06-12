import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../index';
import type { DawTimeFormatElement } from '../elements/daw-time-format';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));

describe('daw-time-format', () => {
  let fakeEditor: HTMLElement & { setTimeFormat?: (f: string) => void };
  let element: DawTimeFormatElement;

  beforeEach(async () => {
    fakeEditor = document.createElement('div');
    fakeEditor.id = 'fake-ed';
    // Mirror the real editor contract: setTimeFormat dispatches
    // daw-time-format-change on actual changes (and never on same-value sets).
    Object.assign(fakeEditor, {
      timeFormat: 'hh:mm:ss',
      setTimeFormat: vi.fn((format: string) => {
        const ed = fakeEditor as HTMLElement & { timeFormat?: string };
        if (ed.timeFormat === format) return;
        ed.timeFormat = format;
        fakeEditor.dispatchEvent(
          new CustomEvent('daw-time-format-change', {
            bubbles: true,
            composed: true,
            detail: { format },
          })
        );
      }),
    });
    document.body.appendChild(fakeEditor);
    document.body.insertAdjacentHTML(
      'beforeend',
      '<daw-transport for="fake-ed"><daw-time-format></daw-time-format></daw-transport>'
    );
    element = document.querySelector('daw-time-format') as DawTimeFormatElement;
    await nextFrame();
    await element.updateComplete;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders a select with the three formats and an aria-label', () => {
    const select = element.shadowRoot!.querySelector('select')!;
    expect(select.getAttribute('aria-label')).toBe('Time format');
    const values = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    expect(values).toEqual(['hh:mm:ss.sss', 'hh:mm:ss', 'seconds']);
  });

  it('initializes its value from the target timeFormat', () => {
    const select = element.shadowRoot!.querySelector('select')!;
    expect(select.value).toBe('hh:mm:ss');
  });

  it('calls target.setTimeFormat on change', () => {
    const select = element.shadowRoot!.querySelector('select')!;
    select.value = 'seconds';
    select.dispatchEvent(new Event('change'));
    expect(fakeEditor.setTimeFormat).toHaveBeenCalledWith('seconds');
  });

  it('follows daw-time-format-change events from the target (programmatic sync)', async () => {
    fakeEditor.dispatchEvent(
      new CustomEvent('daw-time-format-change', {
        bubbles: true,
        composed: true,
        detail: { format: 'seconds' },
      })
    );
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('select')!.value).toBe('seconds');
  });

  it('syncs the select IDL value on programmatic format changes (option dirtiness guard)', async () => {
    const select = element.shadowRoot!.querySelector('select')!;
    // simulate a user pick, then two programmatic round-trips
    select.value = 'seconds';
    select.dispatchEvent(new Event('change'));
    fakeEditor.dispatchEvent(
      new CustomEvent('daw-time-format-change', {
        bubbles: true,
        composed: true,
        detail: { format: 'hh:mm:ss' },
      })
    );
    await element.updateComplete;
    expect(select.value).toBe('hh:mm:ss');
    fakeEditor.dispatchEvent(
      new CustomEvent('daw-time-format-change', {
        bubbles: true,
        composed: true,
        detail: { format: 'seconds' },
      })
    );
    await element.updateComplete;
    expect(select.value).toBe('seconds');
  });

  it('warns once on pointer interaction when the transport target is missing', async () => {
    document.body.innerHTML = '';
    document.body.insertAdjacentHTML(
      'beforeend',
      '<daw-transport for="nope"><daw-time-format></daw-time-format></daw-transport>'
    );
    const el = document.querySelector('daw-time-format') as DawTimeFormatElement;
    await nextFrame();
    await el.updateComplete;
    // Benefit of the doubt: a missing target keeps the select enabled —
    // interaction-time resolution warns instead of latching disabled.
    expect(el.shadowRoot!.querySelector('select')!.disabled).toBe(false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('no target');
  });

  it('renders disabled against a target lacking setTimeFormat, warns once on interaction', async () => {
    document.body.innerHTML = '';
    const bare = document.createElement('div');
    bare.id = 'bare';
    document.body.appendChild(bare);
    document.body.insertAdjacentHTML(
      'beforeend',
      '<daw-transport for="bare"><daw-time-format></daw-time-format></daw-transport>'
    );
    const el = document.querySelector('daw-time-format') as DawTimeFormatElement;
    await nextFrame();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('select')!.disabled).toBe(true);

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('setTimeFormat');
  });
});
