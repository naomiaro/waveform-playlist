import { describe, it, expect, vi, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-record-button');
});

describe('DawRecordButtonElement', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-record-button')).toBeDefined();
  });

  it('renders a button with Record slot', async () => {
    const el = document.createElement('daw-record-button') as any;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 10));
    const button = el.shadowRoot?.querySelector('button');
    expect(button).toBeTruthy();
    document.body.removeChild(el);
  });

  it('warns when target is null on click', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = document.createElement('daw-record-button') as any;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 10));

    const button = el.shadowRoot?.querySelector('button');
    button?.click();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no target'));
    warnSpy.mockRestore();
    document.body.removeChild(el);
  });
});
