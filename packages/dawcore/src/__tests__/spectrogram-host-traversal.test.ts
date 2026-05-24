import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import type { DawSpectrogramElement } from '../elements/daw-spectrogram';

beforeAll(async () => {
  // Side-effect import registers <daw-spectrogram>.
  await import('../elements/daw-spectrogram');
});

const NO_HOST_PATTERN = 'could not find host <daw-editor>';

function countNoHostWarns(spy: ReturnType<typeof vi.spyOn>): number {
  return spy.mock.calls.filter((call) => {
    const first = call[0];
    return typeof first === 'string' && first.includes(NO_HOST_PATTERN);
  }).length;
}

describe('<daw-spectrogram> host traversal', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    document.body.replaceChildren();
  });

  it('warns when mounted in light DOM with no <daw-editor> ancestor', async () => {
    const el = document.createElement('daw-spectrogram') as DawSpectrogramElement;
    el.clipId = 'c1';
    el.length = 500;
    document.body.appendChild(el);

    // Wait for Lit's first update + the rAF inside updated() to call _registerCanvases.
    await el.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    expect(countNoHostWarns(warnSpy)).toBeGreaterThanOrEqual(1);
  });

  it('warns only once per element even if _registerCanvases runs multiple times', async () => {
    const el = document.createElement('daw-spectrogram') as DawSpectrogramElement;
    el.clipId = 'c2';
    el.length = 500;
    document.body.appendChild(el);

    await el.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const warnsAfterFirstRegister = countNoHostWarns(warnSpy);

    // Force the private method to run again — the warn-once flag must dedupe.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const elAny = el as any;
    if (typeof elAny._registerCanvases !== 'function') {
      throw new Error('expected _registerCanvases on <daw-spectrogram>');
    }
    elAny._registerCanvases();
    elAny._registerCanvases();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const warnsAfterRetries = countNoHostWarns(warnSpy);
    expect(warnsAfterRetries).toBe(warnsAfterFirstRegister);
    expect(warnsAfterRetries).toBe(1);
  });

  it('finds host editor through getRootNode().host when inside shadow DOM', () => {
    // Build a shadow tree whose host satisfies the `<daw-editor>` ancestor check.
    // A <div> shadow host with a <daw-editor>-named ancestor exercises the
    // `closest('daw-editor')` fallback branch — covering both DOM hops without
    // instantiating the real <daw-editor> (which would require an adapter).
    const editorAncestor = document.createElement('daw-editor');
    // Avoid running editor.connectedCallback machinery — keep it detached from body.
    const shadowHost = document.createElement('div');
    editorAncestor.appendChild(shadowHost);
    document.body.appendChild(editorAncestor);

    const shadow = shadowHost.attachShadow({ mode: 'open' });
    const el = document.createElement('daw-spectrogram') as DawSpectrogramElement;
    shadow.appendChild(el);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const found = (el as any)._findHostEditor();
    expect(found).toBe(editorAncestor);
  });
});
