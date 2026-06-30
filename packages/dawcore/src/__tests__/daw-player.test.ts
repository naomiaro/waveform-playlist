import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import type { DawPlayerElement } from '../elements/daw-player';

beforeAll(async () => {
  await import('../elements/daw-player');
});

function makePlayer(): DawPlayerElement {
  const el = document.createElement('daw-player') as DawPlayerElement;
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.querySelectorAll('daw-player').forEach((el) => el.remove());
  vi.restoreAllMocks();
});

describe('DawPlayerElement — scaffold', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-player')).toBeDefined();
  });

  it('uses Shadow DOM', async () => {
    const el = makePlayer();
    await el.updateComplete;
    expect(el.shadowRoot).toBeTruthy();
  });

  it('defaults: waveHeight 128, timescale false, mono false, barWidth 1, barGap 0, rate 1', () => {
    const el = makePlayer();
    expect(el.waveHeight).toBe(128);
    expect(el.timescale).toBe(false);
    expect(el.mono).toBe(false);
    expect(el.barWidth).toBe(1);
    expect(el.barGap).toBe(0);
    expect(el.playbackRate).toBe(1);
  });

  it('reads attributes into properties', async () => {
    const el = makePlayer();
    el.setAttribute('wave-height', '64');
    el.setAttribute('timescale', '');
    el.setAttribute('bar-width', '2');
    await el.updateComplete;
    expect(el.waveHeight).toBe(64);
    expect(el.timescale).toBe(true);
    expect(el.barWidth).toBe(2);
  });

  it('clamps playback-rate into 0.25–4.0 with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = makePlayer();
    el.playbackRate = 8;
    expect(el.playbackRate).toBe(4.0);
    el.playbackRate = 0.1;
    expect(el.playbackRate).toBe(0.25);
    expect(warn).toHaveBeenCalled();
  });
});
