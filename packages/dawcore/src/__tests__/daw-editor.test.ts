import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-clip');
  await import('../elements/daw-track');
  await import('../elements/daw-editor');
});

describe('DawEditorElement', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-editor')).toBeDefined();
  });

  it('reflects attribute defaults', () => {
    const el = document.createElement('daw-editor') as any;
    expect(el.samplesPerPixel).toBe(1024);
    expect(el.waveHeight).toBe(128);
    expect(el.timescale).toBe(false);
    expect(el.mono).toBe(false);
  });

  it('exposes playback methods', () => {
    const el = document.createElement('daw-editor') as any;
    expect(typeof el.play).toBe('function');
    expect(typeof el.pause).toBe('function');
    expect(typeof el.stop).toBe('function');
    expect(typeof el.seekTo).toBe('function');
  });

  it('uses Shadow DOM', () => {
    const el = document.createElement('daw-editor') as any;
    document.body.appendChild(el);
    expect(el.shadowRoot).toBeTruthy();
    document.body.removeChild(el);
  });

  it('discovers child daw-track elements', async () => {
    const el = document.createElement('daw-editor') as any;
    const track = document.createElement('daw-track');
    track.setAttribute('name', 'Test Track');
    el.appendChild(track);
    document.body.appendChild(el);

    // Wait for Lit to update and MutationObserver to fire
    await new Promise((r) => setTimeout(r, 50));

    // Editor should have discovered the track
    expect(el.tracks.length).toBe(1);
    expect(el.tracks[0].name).toBe('Test Track');

    document.body.removeChild(el);
  });
});
