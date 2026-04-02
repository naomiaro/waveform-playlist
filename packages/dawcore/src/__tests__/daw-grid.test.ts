import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-grid');
});

describe('DawGridElement', () => {
  it('is defined as a custom element', () => {
    expect(customElements.get('daw-grid')).toBeDefined();
  });

  it('creates shadow root', () => {
    const el = document.createElement('daw-grid') as any;
    document.body.appendChild(el);
    expect(el.shadowRoot).toBeTruthy();
    document.body.removeChild(el);
  });

  it('renders canvas chunks when length > 0', async () => {
    const el = document.createElement('daw-grid') as any;
    el.length = 2000;
    el.height = 100;
    el.ticksPerPixel = 4;
    el.meterEntries = [{ tick: 0, numerator: 4, denominator: 4 }];
    document.body.appendChild(el);

    // Wait for Lit update cycle.
    await el.updateComplete;

    const canvases = el.shadowRoot?.querySelectorAll('canvas');
    expect(canvases?.length).toBeGreaterThan(0);

    document.body.removeChild(el);
  });

  it('renders no canvases when length is 0', async () => {
    const el = document.createElement('daw-grid') as any;
    el.length = 0;
    document.body.appendChild(el);

    await el.updateComplete;

    const canvases = el.shadowRoot?.querySelectorAll('canvas');
    expect(canvases?.length).toBe(0);

    document.body.removeChild(el);
  });

  it('has expected default property values', () => {
    const el = document.createElement('daw-grid') as any;
    expect(el.ticksPerPixel).toBe(24);
    expect(el.meterEntries).toEqual([{ tick: 0, numerator: 4, denominator: 4 }]);
    expect(el.ppqn).toBe(960);
    expect(el.visibleStart).toBe(-Infinity);
    expect(el.visibleEnd).toBe(Infinity);
    expect(el.length).toBe(0);
    expect(el.height).toBe(200);
  });

  it('renders 2 chunks for 1500px content', async () => {
    const el = document.createElement('daw-grid') as any;
    el.length = 1500;
    el.height = 100;
    el.ticksPerPixel = 4;
    document.body.appendChild(el);

    await el.updateComplete;

    const canvases = el.shadowRoot?.querySelectorAll('canvas');
    // 1500px with 1000px chunks → 2 chunks
    expect(canvases?.length).toBe(2);

    document.body.removeChild(el);
  });

  it('respects visibleStart/visibleEnd for virtual scrolling', async () => {
    const el = document.createElement('daw-grid') as any;
    el.length = 5000;
    el.height = 100;
    el.ticksPerPixel = 4;
    // Only show the second 1000px chunk
    el.visibleStart = 1000;
    el.visibleEnd = 2000;
    document.body.appendChild(el);

    await el.updateComplete;

    const canvases = el.shadowRoot?.querySelectorAll('canvas');
    // Only chunk index 1 (1000–2000px) should be rendered
    expect(canvases?.length).toBe(1);
    expect((canvases?.[0] as HTMLElement).dataset.index).toBe('1');

    document.body.removeChild(el);
  });
});
