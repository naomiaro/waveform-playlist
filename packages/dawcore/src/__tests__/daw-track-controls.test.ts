import { describe, it, expect, beforeAll } from 'vitest';
import type { DawTrackControlsElement } from '../elements/daw-track-controls';

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

  it('the mute button is disabled while armed; a click sends nothing', async () => {
    const el = document.createElement('daw-track-controls') as any;
    el.trackId = 'track-1';
    el.muted = true;
    el.armed = true;
    document.body.appendChild(el);
    await el.updateComplete;

    const events: CustomEvent[] = [];
    el.addEventListener('daw-track-control', (e: CustomEvent) => events.push(e));
    const muteBtn = el.shadowRoot.querySelector('button[title="Mute"]');
    expect(muteBtn.disabled).toBe(true);
    muteBtn.click();
    el['_onMuteClick']();
    expect(events).toHaveLength(0);

    el.armed = false;
    await el.updateComplete;
    expect(muteBtn.disabled).toBe(false);
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
    expect(events[0].detail).toEqual({
      trackId: 'track-1',
      prop: 'volume',
      value: 0.5,
      gesture: expect.any(String),
    });
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
    expect(events[0].detail).toEqual({
      trackId: 'track-1',
      prop: 'pan',
      value: -0.3,
      gesture: expect.any(String),
    });
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

  // #843: one gesture id per slider, so the editor makes one undo step of
  // a drag or a key press. Mute and solo send none: each click is a step.
  describe('slider gestures (#843)', () => {
    async function mount() {
      const el = document.createElement('daw-track-controls') as any;
      el.trackId = 'track-1';
      document.body.appendChild(el);
      await el.updateComplete;
      const details: any[] = [];
      el.addEventListener('daw-track-control', (e: CustomEvent) => details.push(e.detail));
      const [volume, pan] = el.shadowRoot.querySelectorAll('input[type="range"]');
      return { el, details, volume, pan };
    }
    function move(input: HTMLInputElement, value: string) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function release(input: HTMLInputElement) {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function key(input: HTMLInputElement, type: 'keydown' | 'keyup', k: string) {
      input.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true }));
    }

    it("the event detail carries the slider's gesture id", async () => {
      const { el, details, volume, pan } = await mount();
      move(volume, '0.9');
      move(volume, '0.8');
      release(volume);
      move(volume, '0.7');
      move(pan, '0.2');
      el.shadowRoot.querySelector('button[title="Mute"]').click();

      const [first, second, third, panDetail, muteDetail] = details;
      expect(typeof first.gesture).toBe('string');
      // One drag, one id; the change ended it, so the next drag has another.
      expect(second.gesture).toBe(first.gesture);
      expect(third.gesture).not.toBe(first.gesture);
      // Each slider has its own.
      expect(typeof panDetail.gesture).toBe('string');
      expect(panDetail.gesture).not.toBe(third.gesture);
      expect(muteDetail).not.toHaveProperty('gesture');
      el.remove();
    });

    it('a held key is one gesture, ended by its keyup', async () => {
      const { el, details, volume } = await mount();
      key(volume, 'keydown', 'ArrowUp');
      move(volume, '0.9');
      release(volume);
      key(volume, 'keydown', 'ArrowUp');
      move(volume, '0.8');
      release(volume);
      key(volume, 'keyup', 'ArrowUp');
      move(volume, '0.7');

      expect(details[1].gesture).toBe(details[0].gesture);
      expect(details[2].gesture).not.toBe(details[0].gesture);
      el.remove();
    });

    it('detaches on disconnect and attaches again on reconnect', async () => {
      const { el, details, volume } = await mount();
      move(volume, '0.9');
      el.remove();
      release(volume); // not listened to while disconnected
      document.body.appendChild(el);
      await el.updateComplete;
      move(volume, '0.8');
      expect(details[1].gesture).toBe(details[0].gesture);

      release(volume); // listened to again
      move(volume, '0.7');
      expect(details[2].gesture).not.toBe(details[1].gesture);
      el.remove();
    });
  });

  describe('compact modes', () => {
    it('marks the slider rows with vol-row / pan-row classes', async () => {
      const el = document.createElement('daw-track-controls') as any;
      document.body.appendChild(el);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('.slider-row.vol-row')).not.toBeNull();
      expect(el.shadowRoot!.querySelector('.slider-row.pan-row')).not.toBeNull();
      el.remove();
    });

    it('declares size containment and container-query compact rules', () => {
      const ctor = customElements.get('daw-track-controls') as any;
      const cssText = Array.isArray(ctor.styles)
        ? ctor.styles.map((s: any) => s.cssText ?? String(s)).join('\n')
        : (ctor.styles.cssText ?? String(ctor.styles));
      expect(cssText).toMatch(/:host\s*\{[^}]*container-type:\s*size/);
      expect(cssText).toContain('@container (max-height: 76px)');
      expect(cssText).toContain('@container (max-height: 60px)');
    });
  });

  describe('reordering', () => {
    it('reorderable renders grip and move buttons; buttons dispatch daw-track-reorder', async () => {
      const el = document.createElement('daw-track-controls') as DawTrackControlsElement;
      el.trackId = 't1';
      el.reorderable = true;
      el.trackIndex = 1;
      el.trackCount = 3;
      document.body.appendChild(el);
      await el.updateComplete;
      const events: CustomEvent[] = [];
      el.addEventListener('daw-track-reorder', ((e: CustomEvent) => {
        events.push(e);
      }) as EventListener);
      const up = el.shadowRoot!.querySelector('.reorder-up') as HTMLButtonElement;
      const down = el.shadowRoot!.querySelector('.reorder-down') as HTMLButtonElement;
      up.click();
      down.click();
      expect(events.map((e) => e.detail)).toEqual([
        { trackId: 't1', fromIndex: 1, toIndex: 0 },
        { trackId: 't1', fromIndex: 1, toIndex: 2 },
      ]);
      el.remove();
    });

    it('move up is disabled at index 0, move down at the last index', async () => {
      const el = document.createElement('daw-track-controls') as DawTrackControlsElement;
      el.trackId = 't1';
      el.reorderable = true;
      el.trackIndex = 0;
      el.trackCount = 3;
      document.body.appendChild(el);
      await el.updateComplete;

      let up = el.shadowRoot!.querySelector('.reorder-up') as HTMLButtonElement;
      let down = el.shadowRoot!.querySelector('.reorder-down') as HTMLButtonElement;
      expect(up.disabled).toBe(true);
      expect(down.disabled).toBe(false);

      el.trackIndex = 2;
      await el.updateComplete;
      up = el.shadowRoot!.querySelector('.reorder-up') as HTMLButtonElement;
      down = el.shadowRoot!.querySelector('.reorder-down') as HTMLButtonElement;
      expect(up.disabled).toBe(false);
      expect(down.disabled).toBe(true);

      el.remove();
    });

    it('non-reorderable renders no grip/buttons', async () => {
      const el = document.createElement('daw-track-controls') as DawTrackControlsElement;
      el.trackId = 't1';
      document.body.appendChild(el);
      await el.updateComplete;

      expect(el.shadowRoot!.querySelector('.grip')).toBeNull();
      expect(el.shadowRoot!.querySelector('.reorder-up')).toBeNull();
      expect(el.shadowRoot!.querySelector('.reorder-down')).toBeNull();

      el.remove();
    });
  });
});
