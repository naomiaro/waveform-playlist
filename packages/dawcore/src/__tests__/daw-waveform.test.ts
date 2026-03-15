import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-waveform');
});

describe('DawWaveformElement', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-waveform')).toBeDefined();
  });

  it('has default property values', () => {
    const el = document.createElement('daw-waveform') as any;
    expect(el.waveHeight).toBe(128);
    expect(el.barWidth).toBe(1);
    expect(el.barGap).toBe(0);
    expect(el.bits).toBe(16);
    expect(el.length).toBe(0);
  });

  it('uses Shadow DOM', () => {
    const el = document.createElement('daw-waveform') as any;
    document.body.appendChild(el);
    expect(el.shadowRoot).toBeTruthy();
    document.body.removeChild(el);
  });
});
