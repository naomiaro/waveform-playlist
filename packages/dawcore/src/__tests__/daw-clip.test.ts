import { describe, it, expect, beforeAll, vi } from 'vitest';

// Register elements
beforeAll(async () => {
  await import('../elements/daw-clip');
  await import('../elements/daw-track');
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

  it('exposes midiNotes JS property defaulting to null', () => {
    const el = document.createElement('daw-clip') as any;
    expect(el.midiNotes).toBeNull();
  });

  it('reflects midi-channel attribute as midiChannel number', () => {
    const el = document.createElement('daw-clip') as any;
    el.setAttribute('midi-channel', '9');
    expect(el.midiChannel).toBe(9);
  });

  it('reflects midi-program attribute as midiProgram number', () => {
    const el = document.createElement('daw-clip') as any;
    el.setAttribute('midi-program', '24');
    expect(el.midiProgram).toBe(24);
  });

  it('rejects out-of-range midi-channel and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const el = document.createElement('daw-clip') as any;
      el.midiChannel = 16; // invalid
      expect(el.midiChannel).toBeNull(); // unchanged
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('midi-channel 16'));
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('rejects out-of-range midi-program and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const el = document.createElement('daw-clip') as any;
      el.midiProgram = 200; // invalid
      expect(el.midiProgram).toBeNull(); // unchanged
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('midi-program 200'));
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('accepts null to clear midiChannel / midiProgram', () => {
    const el = document.createElement('daw-clip') as any;
    el.midiChannel = 5;
    el.midiChannel = null;
    expect(el.midiChannel).toBeNull();
    el.midiProgram = 24;
    el.midiProgram = null;
    expect(el.midiProgram).toBeNull();
  });

  it('dispatches daw-clip-update when midiNotes is set after first render', async () => {
    const trackEl = document.createElement('daw-track') as any;
    const clipEl = document.createElement('daw-clip') as any;
    trackEl.appendChild(clipEl);
    document.body.appendChild(trackEl);
    await clipEl.updateComplete;

    let detail: any = null;
    trackEl.addEventListener('daw-clip-update', (e: any) => {
      detail = e.detail;
    });

    clipEl.midiNotes = [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }];
    await clipEl.updateComplete;

    expect(detail).toEqual({ trackId: trackEl.trackId, clipId: clipEl.clipId });
    document.body.removeChild(trackEl);
  });

  describe('lifecycle events', () => {
    it('dispatches daw-clip-connected with clipId + element after deferred microtask', async () => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const events: CustomEvent[] = [];
      host.addEventListener('daw-clip-connected', (e) => events.push(e as CustomEvent));

      const el = document.createElement('daw-clip') as any;
      host.appendChild(el);
      // Should NOT fire synchronously — the dispatch is deferred via setTimeout(0)
      // so the editor's daw-track-connected handler runs first.
      expect(events).toHaveLength(0);

      await new Promise((r) => setTimeout(r, 0));
      expect(events).toHaveLength(1);
      expect(events[0].detail.clipId).toBe(el.clipId);
      expect(events[0].detail.element).toBe(el);
      expect(events[0].bubbles).toBe(true);
      expect(events[0].composed).toBe(true);

      document.body.removeChild(host);
    });

    it('dispatches daw-clip-update only after first render, not on initial property assignment', async () => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const events: CustomEvent[] = [];
      host.addEventListener('daw-clip-update', (e) => events.push(e as CustomEvent));

      const el = document.createElement('daw-clip') as any;
      el.setAttribute('start', '4');
      host.appendChild(el);

      // First render — should not fire (initial state isn't a "change")
      await el.updateComplete;
      expect(events).toHaveLength(0);

      // Subsequent change — should fire
      el.start = 8;
      await el.updateComplete;
      expect(events).toHaveLength(1);
      expect(events[0].detail.clipId).toBe(el.clipId);

      document.body.removeChild(host);
    });

    it('daw-clip-update covers all reflected position/property changes', async () => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const el = document.createElement('daw-clip') as any;
      host.appendChild(el);
      await el.updateComplete; // initial render

      const events: CustomEvent[] = [];
      host.addEventListener('daw-clip-update', (e) => events.push(e as CustomEvent));

      // Each property change should fire one event
      el.start = 1;
      await el.updateComplete;
      el.duration = 2;
      await el.updateComplete;
      el.offset = 3;
      await el.updateComplete;
      el.gain = 0.5;
      await el.updateComplete;
      expect(events.length).toBe(4);

      document.body.removeChild(host);
    });
  });
});
