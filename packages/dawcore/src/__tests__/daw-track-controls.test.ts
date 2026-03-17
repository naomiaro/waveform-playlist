import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-track-controls');
});

describe('DawTrackControlsElement', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-track-controls')).toBeDefined();
  });

  it('uses Shadow DOM', () => {
    const el = document.createElement('daw-track-controls') as any;
    document.body.appendChild(el);
    expect(el.shadowRoot).toBeTruthy();
    document.body.removeChild(el);
  });

  it('has default property values', () => {
    const el = document.createElement('daw-track-controls') as any;
    expect(el.trackId).toBeNull();
    expect(el.trackName).toBe('');
    expect(el.volume).toBe(1);
    expect(el.pan).toBe(0);
    expect(el.muted).toBe(false);
    expect(el.soloed).toBe(false);
  });

  it('dispatches daw-track-control on mute toggle', async () => {
    const el = document.createElement('daw-track-controls') as any;
    el.trackId = 'track-1';
    el.muted = false;
    document.body.appendChild(el);
    await el.updateComplete;

    const events: CustomEvent[] = [];
    el.addEventListener('daw-track-control', (e: CustomEvent) => events.push(e));

    const muteBtn = el.shadowRoot.querySelector('button[title="Mute"]');
    expect(muteBtn).toBeTruthy();
    muteBtn.click();

    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ trackId: 'track-1', prop: 'muted', value: true });
    document.body.removeChild(el);
  });

  it('dispatches daw-track-control on solo toggle', async () => {
    const el = document.createElement('daw-track-controls') as any;
    el.trackId = 'track-1';
    el.soloed = false;
    document.body.appendChild(el);
    await el.updateComplete;

    const events: CustomEvent[] = [];
    el.addEventListener('daw-track-control', (e: CustomEvent) => events.push(e));

    const soloBtn = el.shadowRoot.querySelector('button[title="Solo"]');
    soloBtn.click();

    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ trackId: 'track-1', prop: 'soloed', value: true });
    document.body.removeChild(el);
  });

  it('dispatches daw-track-remove on remove click', async () => {
    const el = document.createElement('daw-track-controls') as any;
    el.trackId = 'track-1';
    document.body.appendChild(el);
    await el.updateComplete;

    const events: CustomEvent[] = [];
    el.addEventListener('daw-track-remove', (e: CustomEvent) => events.push(e));

    const removeBtn = el.shadowRoot.querySelector('button[title="Remove track"]');
    removeBtn.click();

    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ trackId: 'track-1' });
    document.body.removeChild(el);
  });

  it('does not dispatch events without trackId', async () => {
    const el = document.createElement('daw-track-controls') as any;
    // trackId is null by default
    document.body.appendChild(el);
    await el.updateComplete;

    const events: Event[] = [];
    el.addEventListener('daw-track-control', (e: Event) => events.push(e));
    el.addEventListener('daw-track-remove', (e: Event) => events.push(e));

    const muteBtn = el.shadowRoot.querySelector('button[title="Mute"]');
    const removeBtn = el.shadowRoot.querySelector('button[title="Remove track"]');
    muteBtn.click();
    removeBtn.click();

    expect(events).toHaveLength(0);
    document.body.removeChild(el);
  });

  it('displays track name', async () => {
    const el = document.createElement('daw-track-controls') as any;
    el.trackName = 'Kick';
    document.body.appendChild(el);
    await el.updateComplete;

    const nameEl = el.shadowRoot.querySelector('.name');
    expect(nameEl.textContent).toBe('Kick');
    document.body.removeChild(el);
  });

  it('displays "Untitled" when no track name', async () => {
    const el = document.createElement('daw-track-controls') as any;
    document.body.appendChild(el);
    await el.updateComplete;

    const nameEl = el.shadowRoot.querySelector('.name');
    expect(nameEl.textContent).toBe('Untitled');
    document.body.removeChild(el);
  });

  it('displays volume percentage', async () => {
    const el = document.createElement('daw-track-controls') as any;
    el.volume = 0.75;
    document.body.appendChild(el);
    await el.updateComplete;

    const volValue = el.shadowRoot.querySelector('.slider-label-value');
    expect(volValue.textContent).toBe('75%');
    document.body.removeChild(el);
  });

  it('displays pan as L/C/R with percentage', async () => {
    const el = document.createElement('daw-track-controls') as any;
    document.body.appendChild(el);

    el.pan = 0;
    await el.updateComplete;
    const panValues = el.shadowRoot.querySelectorAll('.slider-label-value');
    const panValue = panValues[1]; // second slider-label-value is pan
    expect(panValue.textContent).toBe('C');

    el.pan = 0.5;
    await el.updateComplete;
    expect(panValue.textContent).toBe('R50');

    el.pan = -0.75;
    await el.updateComplete;
    expect(panValue.textContent).toBe('L75');

    document.body.removeChild(el);
  });

  it('dispatches daw-track-control on volume slider input', async () => {
    const el = document.createElement('daw-track-controls') as any;
    el.trackId = 'track-1';
    document.body.appendChild(el);
    await el.updateComplete;

    const events: CustomEvent[] = [];
    el.addEventListener('daw-track-control', (e: CustomEvent) => events.push(e));

    const slider = el.shadowRoot.querySelectorAll('input[type="range"]')[0];
    slider.value = '0.5';
    slider.dispatchEvent(new Event('input', { bubbles: true }));

    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ trackId: 'track-1', prop: 'volume', value: 0.5 });
    document.body.removeChild(el);
  });

  it('dispatches daw-track-control on pan slider input', async () => {
    const el = document.createElement('daw-track-controls') as any;
    el.trackId = 'track-1';
    document.body.appendChild(el);
    await el.updateComplete;

    const events: CustomEvent[] = [];
    el.addEventListener('daw-track-control', (e: CustomEvent) => events.push(e));

    const slider = el.shadowRoot.querySelectorAll('input[type="range"]')[1];
    slider.value = '-0.3';
    slider.dispatchEvent(new Event('input', { bubbles: true }));

    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ trackId: 'track-1', prop: 'pan', value: -0.3 });
    document.body.removeChild(el);
  });

  it('events have composed: true for Shadow DOM crossing', async () => {
    const el = document.createElement('daw-track-controls') as any;
    el.trackId = 'track-1';
    document.body.appendChild(el);
    await el.updateComplete;

    let composed: boolean | undefined;
    el.addEventListener('daw-track-control', (e: CustomEvent) => {
      composed = e.composed;
    });

    const muteBtn = el.shadowRoot.querySelector('button[title="Mute"]');
    muteBtn.click();

    expect(composed).toBe(true);
    document.body.removeChild(el);
  });
});
