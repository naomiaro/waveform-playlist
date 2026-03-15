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

  it('positions via stopAnimation', async () => {
    const el = document.createElement('daw-playhead') as any;
    document.body.appendChild(el);

    // Wait for firstUpdated
    await el.updateComplete;

    // Place playhead at 2 seconds, sampleRate=48000, samplesPerPixel=1024
    // Expected px = (2 * 48000) / 1024 = 93.75
    el.stopAnimation(2, 48000, 1024);
    const line = el.shadowRoot.querySelector('div');
    expect(line.style.transform).toContain('93.75');
    document.body.removeChild(el);
  });
});
