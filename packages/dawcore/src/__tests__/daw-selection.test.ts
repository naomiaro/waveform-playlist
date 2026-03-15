import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-selection');
});

describe('DawSelectionElement', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-selection')).toBeDefined();
  });

  it('uses Shadow DOM', () => {
    const el = document.createElement('daw-selection') as any;
    document.body.appendChild(el);
    expect(el.shadowRoot).toBeTruthy();
    document.body.removeChild(el);
  });

  it('has default start and end of 0', () => {
    const el = document.createElement('daw-selection') as any;
    expect(el.startPx).toBe(0);
    expect(el.endPx).toBe(0);
  });
});
