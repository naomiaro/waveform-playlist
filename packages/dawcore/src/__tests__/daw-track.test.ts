import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-clip');
  await import('../elements/daw-track');
});

describe('DawTrackElement', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-track')).toBeDefined();
  });

  it('has a stable trackId', () => {
    const el = document.createElement('daw-track') as any;
    expect(typeof el.trackId).toBe('string');
    expect(el.trackId).toBe(el.trackId);
  });

  it('reflects track attributes', () => {
    const el = document.createElement('daw-track') as any;
    el.setAttribute('name', 'Vocals');
    el.setAttribute('volume', '0.8');
    el.setAttribute('pan', '-0.5');
    expect(el.name).toBe('Vocals');
    expect(el.volume).toBe(0.8);
    expect(el.pan).toBe(-0.5);
  });

  it('reflects boolean attributes', () => {
    const el = document.createElement('daw-track') as any;
    expect(el.muted).toBe(false);
    expect(el.soloed).toBe(false);
    el.setAttribute('muted', '');
    expect(el.muted).toBe(true);
  });

  it('can query child daw-clip elements', () => {
    const track = document.createElement('daw-track') as any;
    const clip1 = document.createElement('daw-clip');
    clip1.setAttribute('src', '/audio/a.mp3');
    const clip2 = document.createElement('daw-clip');
    clip2.setAttribute('src', '/audio/b.mp3');
    track.appendChild(clip1);
    track.appendChild(clip2);
    expect(track.querySelectorAll('daw-clip').length).toBe(2);
  });

  it('dispatches daw-track-update on attribute change (not on initial render)', async () => {
    const track = document.createElement('daw-track') as any;
    document.body.appendChild(track);

    // Wait for initial render to complete (skipped by _hasRendered guard)
    await track.updateComplete;

    const events: CustomEvent[] = [];
    track.addEventListener('daw-track-update', (e: CustomEvent) => events.push(e));

    // Now change a property — this should fire the event
    track.volume = 0.5;
    await track.updateComplete;

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].detail.trackId).toBe(track.trackId);

    document.body.removeChild(track);
  });
});
