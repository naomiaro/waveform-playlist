import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';

beforeAll(async () => {
  // Register all elements before template cloning (happy-dom 20 upgrades
  // cloned elements only if the class is defined first).
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
  await import('../elements/daw-piano-roll');
  await import('../elements/daw-ruler');
  await import('../elements/daw-grid');
});

beforeEach(() => {
  vi.stubGlobal('devicePixelRatio', 1);
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no fetch in layout tests')));
  // happy-dom canvas getContext returns null — ruler/grid drawing needs a mock.
  const mockCtx = {
    clearRect: vi.fn(),
    resetTransform: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textBaseline: '',
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeMockAdapter() {
  const ctx = {
    sampleRate: 48000,
    state: 'suspended' as AudioContextState,
    destination: {} as AudioDestinationNode,
    resume: vi.fn().mockResolvedValue(undefined),
    decodeAudioData: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    audioContext: ctx as unknown as AudioContext,
    ppqn: 960,
    setTracks: vi.fn(),
    updateTrack: vi.fn(),
    setTempo: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    init: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    isPlaying: vi.fn().mockReturnValue(false),
  };
}

const NOTES = [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }];

async function makeEditor(trackCount: number, attrs: Record<string, string> = {}) {
  const editor = document.createElement('daw-editor') as any;
  editor.adapter = makeMockAdapter();
  for (const [k, v] of Object.entries(attrs)) editor.setAttribute(k, v);
  document.body.appendChild(editor);
  for (let i = 0; i < trackCount; i++) {
    await editor.addTrack({ name: `T${i}`, midi: { notes: NOTES } });
  }
  await editor.updateComplete;
  return editor;
}

describe('<daw-editor> frozen-panes layout', () => {
  it('renders the ruler in the header band, not inside the timeline', async () => {
    const editor = await makeEditor(1, { timescale: '' });
    const sr = editor.shadowRoot!;
    expect(sr.querySelector('.header-row .ruler-viewport .ruler-content daw-ruler')).not.toBeNull();
    expect(sr.querySelector('.timeline daw-ruler')).toBeNull();
    editor.remove();
  });

  it('renders no header band when timescale is off', async () => {
    const editor = await makeEditor(1);
    expect(editor.shadowRoot!.querySelector('.header-row')).toBeNull();
    editor.remove();
  });

  it('renders the ruler gap only when controls are shown', async () => {
    const editor = await makeEditor(1, { timescale: '' });
    expect(editor.shadowRoot!.querySelector('.header-row .ruler-gap')).not.toBeNull();
    editor.remove();

    // beats mode + no tracks → ruler without gap (timeline is full-width too)
    const empty = document.createElement('daw-editor') as any;
    empty.adapter = makeMockAdapter();
    empty.setAttribute('timescale', '');
    empty.setAttribute('scale-mode', 'beats');
    document.body.appendChild(empty);
    await empty.updateComplete;
    expect(empty.shadowRoot!.querySelector('.header-row')).not.toBeNull();
    expect(empty.shadowRoot!.querySelector('.header-row .ruler-gap')).toBeNull();
    empty.remove();
  });

  it('has no legacy spacer div — controls column starts with track controls', async () => {
    const editor = await makeEditor(2, { timescale: '' });
    const col = editor.shadowRoot!.querySelector('.controls-column')!;
    expect(col.firstElementChild?.tagName.toLowerCase()).toBe('daw-track-controls');
    editor.remove();
  });

  it('nests the controls column inside a clipped viewport', async () => {
    const editor = await makeEditor(1);
    expect(
      editor.shadowRoot!.querySelector('.controls-viewport > .controls-column')
    ).not.toBeNull();
    editor.remove();
  });

  it('gives controls and track rows identical inline heights', async () => {
    const editor = await makeEditor(3, { timescale: '' });
    const sr = editor.shadowRoot!;
    const controls = [...sr.querySelectorAll('daw-track-controls')] as HTMLElement[];
    const rows = [...sr.querySelectorAll('.track-row')] as HTMLElement[];
    expect(controls).toHaveLength(3);
    expect(rows).toHaveLength(3);
    controls.forEach((c, i) => {
      expect(c.style.height).not.toBe('');
      expect(c.style.height).toBe(rows[i].style.height);
    });
    editor.remove();
  });

  it('sizes the beats grid as the exact sum of track heights (no +1), at top 0', async () => {
    const editor = await makeEditor(2, { timescale: '', 'scale-mode': 'beats' });
    const sr = editor.shadowRoot!;
    const grid = sr.querySelector('daw-grid') as any;
    expect(grid).not.toBeNull();
    const rows = [...sr.querySelectorAll('.track-row')] as HTMLElement[];
    const expected = rows.reduce((s, r) => s + parseFloat(r.style.height), 0);
    expect(grid.height).toBe(expected);
    expect(grid.style.top).toBe('0px');
    editor.remove();
  });

  it('declares border-box track rows and a both-axes scroll area in static styles', async () => {
    const editor = await makeEditor(0);
    const cssText = (editor.constructor as any).styles
      .map((s: any) => s.cssText ?? String(s))
      .join('\n');
    expect(cssText).toMatch(/\.track-row\s*\{[^}]*box-sizing:\s*border-box/);
    expect(cssText).toMatch(/\.scroll-area\s*\{[^}]*overflow:\s*auto/);
    expect(cssText).toMatch(/\.scroll-area\s*\{[^}]*overflow-anchor:\s*none/);
    editor.remove();
  });
});
