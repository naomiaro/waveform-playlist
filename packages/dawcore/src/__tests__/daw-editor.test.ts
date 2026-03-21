import { describe, it, expect, beforeAll, vi } from 'vitest';

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

  it('attaches AudioResumeController listeners when eager-resume is set', async () => {
    const el = document.createElement('daw-editor') as any;
    el.setAttribute('eager-resume', '');
    const spy = vi.spyOn(el, 'addEventListener');
    document.body.appendChild(el);

    // Wait for Lit update cycle + rAF
    await new Promise((r) => setTimeout(r, 50));

    const captureListeners = spy.mock.calls.filter(([, , opts]) => (opts as any)?.capture === true);
    expect(captureListeners.length).toBeGreaterThanOrEqual(2);

    document.body.removeChild(el);
    spy.mockRestore();
  });

  it('does not attach listeners when eager-resume is not set', async () => {
    const el = document.createElement('daw-editor') as any;
    const spy = vi.spyOn(el, 'addEventListener');
    document.body.appendChild(el);

    await new Promise((r) => setTimeout(r, 50));

    const captureListeners = spy.mock.calls
      .filter(([type]) => type === 'pointerdown' || type === 'keydown')
      .filter(([, , opts]) => (opts as any)?.capture === true);
    expect(captureListeners.length).toBe(0);

    document.body.removeChild(el);
    spy.mockRestore();
  });

  it('effectiveSampleRate defaults to sampleRate property', () => {
    const el = document.createElement('daw-editor') as any;
    expect(el.effectiveSampleRate).toBe(48000);
  });

  it('resolveAudioContextSampleRate sets effective rate', () => {
    const el = document.createElement('daw-editor') as any;
    el.resolveAudioContextSampleRate(44100);
    expect(el.effectiveSampleRate).toBe(44100);
  });

  it('resolveAudioContextSampleRate only sets once (first wins)', () => {
    const el = document.createElement('daw-editor') as any;
    el.resolveAudioContextSampleRate(44100);
    el.resolveAudioContextSampleRate(96000);
    expect(el.effectiveSampleRate).toBe(44100);
  });

  it('decoded audio _resolvedSampleRate takes precedence over resolveAudioContextSampleRate', () => {
    const el = document.createElement('daw-editor') as any;
    // Simulate what _loadTrack does
    el._resolvedSampleRate = 44100;
    // This should be a no-op since _resolvedSampleRate is already set
    el.resolveAudioContextSampleRate(48000);
    expect(el.effectiveSampleRate).toBe(44100);
  });

  it('passes eager-resume="document" to controller target', async () => {
    const docSpy = vi.spyOn(document, 'addEventListener');
    const el = document.createElement('daw-editor') as any;
    el.setAttribute('eager-resume', 'document');
    document.body.appendChild(el);

    await new Promise((r) => setTimeout(r, 50));

    const docCapture = docSpy.mock.calls.filter(
      ([type, , opts]) =>
        (type === 'pointerdown' || type === 'keydown') && (opts as any)?.capture === true
    );
    expect(docCapture.length).toBeGreaterThanOrEqual(2);

    document.body.removeChild(el);
    docSpy.mockRestore();
  });
});
