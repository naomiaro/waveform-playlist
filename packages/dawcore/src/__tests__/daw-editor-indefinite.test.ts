import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-clip');
  await import('../elements/daw-track');
  await import('../elements/daw-editor');
  await import('../elements/daw-ruler');
});

function setupEditor(opts: { indefinite?: boolean; viewportWidth?: number } = {}) {
  const editor = document.createElement('daw-editor') as any;
  editor.adapter = { audioContext: { state: 'running', sampleRate: 48000 } };
  if (opts.indefinite) editor.setAttribute('indefinite-playback', '');
  document.body.appendChild(editor);
  // Stub viewport's containerWidth — bypasses async ResizeObserver attach
  editor._viewport.containerWidth = opts.viewportWidth ?? 800;
  return editor;
}

describe('indefinite-playback attribute', () => {
  it('reflects to indefinitePlayback property', () => {
    const editor = document.createElement('daw-editor') as any;
    expect(editor.indefinitePlayback).toBe(false);
    editor.setAttribute('indefinite-playback', '');
    expect(editor.indefinitePlayback).toBe(true);
  });
});

describe('_totalWidth viewport floor (temporal mode)', () => {
  it('returns natural width when indefinite-playback is off', () => {
    const editor = setupEditor({ indefinite: false, viewportWidth: 800 });
    editor._duration = 4; // 4s × 48000 / 1024 = 187.5 → 188px
    expect(editor._totalWidth).toBe(188);
    editor.remove();
  });

  it('floors at containerWidth when indefinite-playback is on and natural is shorter', () => {
    const editor = setupEditor({ indefinite: true, viewportWidth: 800 });
    editor._duration = 4; // natural = 188px, viewport = 800px
    expect(editor._totalWidth).toBe(800);
    editor.remove();
  });

  it('uses natural width when it exceeds containerWidth', () => {
    const editor = setupEditor({ indefinite: true, viewportWidth: 800 });
    editor._duration = 60; // 60s × 48000 / 1024 = 2812.5 → 2813px
    expect(editor._totalWidth).toBe(2813);
    editor.remove();
  });

  it('returns 0 with no duration and no viewport when indefinite is off', () => {
    const editor = setupEditor({ indefinite: false, viewportWidth: 0 });
    editor._duration = 0;
    expect(editor._totalWidth).toBe(0);
    editor.remove();
  });

  it('fills viewport when duration is 0 and indefinite is on', () => {
    const editor = setupEditor({ indefinite: true, viewportWidth: 1200 });
    editor._duration = 0;
    expect(editor._totalWidth).toBe(1200);
    editor.remove();
  });
});

describe('controls-column placeholder', () => {
  it('renders an empty controls column when indefinite-playback is set with no tracks', async () => {
    const editor = setupEditor({ indefinite: true, viewportWidth: 800 });
    await editor.updateComplete;
    const col = editor.shadowRoot.querySelector('.controls-column');
    expect(col).not.toBeNull();
    // Empty state has no <daw-track-controls> children
    expect(col.querySelectorAll('daw-track-controls').length).toBe(0);
    editor.remove();
  });

  it('does not render the controls column when neither tracks nor indefinite-playback', async () => {
    const editor = setupEditor({ indefinite: false, viewportWidth: 800 });
    await editor.updateComplete;
    expect(editor.shadowRoot.querySelector('.controls-column')).toBeNull();
    editor.remove();
  });
});

describe('daw-ruler effective duration', () => {
  it('falls back to totalWidth-derived duration when natural duration is 0', () => {
    const ruler = document.createElement('daw-ruler') as any;
    ruler.duration = 0;
    ruler.totalWidth = 2400; // 2400 * 1024 / 48000 = 51.2s
    ruler.samplesPerPixel = 1024;
    ruler.sampleRate = 48000;
    ruler.willUpdate();
    // Tick data should be computed (non-null) for an empty editor with totalWidth
    expect(ruler._tickData).not.toBeNull();
  });

  it('covers the larger of natural duration and totalWidth-derived duration', () => {
    const ruler = document.createElement('daw-ruler') as any;
    // Natural = 4s but totalWidth represents 25s — ruler should cover 25s.
    ruler.duration = 4;
    ruler.totalWidth = 1200; // 1200 * 1024 / 48000 = 25.6s
    ruler.samplesPerPixel = 1024;
    ruler.sampleRate = 48000;
    ruler.willUpdate();
    expect(ruler._tickData).not.toBeNull();
    // widthX should reflect the 25s coverage, not the 4s coverage
    expect(ruler._tickData.widthX).toBeGreaterThan(800);
  });

  it('uses natural duration when it exceeds totalWidth-derived', () => {
    const ruler = document.createElement('daw-ruler') as any;
    ruler.duration = 60; // 60s
    ruler.totalWidth = 200; // 200 * 1024 / 48000 = 4.27s
    ruler.samplesPerPixel = 1024;
    ruler.sampleRate = 48000;
    ruler.willUpdate();
    expect(ruler._tickData).not.toBeNull();
    // widthX should reflect the 60s coverage
    expect(ruler._tickData.widthX).toBeGreaterThan(2000);
  });

  it('returns null tickData when both duration and totalWidth are 0', () => {
    const ruler = document.createElement('daw-ruler') as any;
    ruler.duration = 0;
    ruler.totalWidth = 0;
    ruler.samplesPerPixel = 1024;
    ruler.sampleRate = 48000;
    ruler.willUpdate();
    expect(ruler._tickData).toBeNull();
  });
});
