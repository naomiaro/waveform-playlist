import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-ruler');
});

describe('DawRulerElement', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-ruler')).toBeDefined();
  });

  it('uses Shadow DOM', () => {
    const el = document.createElement('daw-ruler') as any;
    document.body.appendChild(el);
    expect(el.shadowRoot).toBeTruthy();
    document.body.removeChild(el);
  });

  it('has default property values', () => {
    const el = document.createElement('daw-ruler') as any;
    expect(el.samplesPerPixel).toBe(1024);
    expect(el.sampleRate).toBe(48000);
    expect(el.duration).toBe(0);
    expect(el.rulerHeight).toBe(30);
  });
});
