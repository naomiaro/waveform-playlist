import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-playhead');
});

describe('DawPlayheadElement', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-playhead')).toBeDefined();
  });

  it('uses Shadow DOM', () => {
    const el = document.createElement('daw-playhead') as any;
    document.body.appendChild(el);
    expect(el.shadowRoot).toBeTruthy();
    document.body.removeChild(el);
  });

  it('setPosition translates the line to the given pixel offset', async () => {
    const el = document.createElement('daw-playhead') as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.setPosition(42.5);
    const line = el.shadowRoot.querySelector('div');
    expect(line.style.transform).toContain('42.5');
    document.body.removeChild(el);
  });
});
