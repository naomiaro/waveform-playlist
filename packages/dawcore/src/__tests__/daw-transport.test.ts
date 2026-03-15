import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-transport');
  await import('../elements/daw-play-button');
  await import('../elements/daw-pause-button');
  await import('../elements/daw-stop-button');
});

describe('DawTransportElement', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-transport')).toBeDefined();
  });

  it('resolves target from for attribute', () => {
    const target = document.createElement('div');
    target.id = 'test-editor';
    document.body.appendChild(target);

    const transport = document.createElement('daw-transport') as any;
    transport.setAttribute('for', 'test-editor');
    document.body.appendChild(transport);

    expect(transport.target).toBe(target);

    document.body.removeChild(target);
    document.body.removeChild(transport);
  });

  it('returns null when target not found', () => {
    const transport = document.createElement('daw-transport') as any;
    transport.setAttribute('for', 'nonexistent');
    document.body.appendChild(transport);
    expect(transport.target).toBeNull();
    document.body.removeChild(transport);
  });
});

describe('Transport buttons', () => {
  it('all buttons are registered', () => {
    expect(customElements.get('daw-play-button')).toBeDefined();
    expect(customElements.get('daw-pause-button')).toBeDefined();
    expect(customElements.get('daw-stop-button')).toBeDefined();
  });
});
