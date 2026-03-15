import { describe, it, expect, beforeAll } from 'vitest';

// Register element
beforeAll(async () => {
  await import('../elements/daw-clip');
});

describe('DawClipElement', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-clip')).toBeDefined();
  });

  it('has a stable clipId', () => {
    const el = document.createElement('daw-clip') as any;
    expect(typeof el.clipId).toBe('string');
    expect(el.clipId.length).toBeGreaterThan(0);
    // ID is stable across reads
    expect(el.clipId).toBe(el.clipId);
  });

  it('reflects src attribute', () => {
    const el = document.createElement('daw-clip') as any;
    el.setAttribute('src', '/audio/test.mp3');
    expect(el.src).toBe('/audio/test.mp3');
  });

  it('reflects numeric attributes with defaults', () => {
    const el = document.createElement('daw-clip') as any;
    expect(el.start).toBe(0);
    expect(el.duration).toBe(0);
    expect(el.offset).toBe(0);
    expect(el.gain).toBe(1);
  });

  it('reflects fade attributes', () => {
    const el = document.createElement('daw-clip') as any;
    el.setAttribute('fade-in', '0.5');
    el.setAttribute('fade-out', '1.0');
    el.setAttribute('fade-type', 'sCurve');
    expect(el.fadeIn).toBe(0.5);
    expect(el.fadeOut).toBe(1.0);
    expect(el.fadeType).toBe('sCurve');
  });
});
