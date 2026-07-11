import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import '../index'; // registers all elements

beforeAll(async () => {
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
  // happy-dom canvas getContext returns null — ruler/grid/piano-roll drawing needs a mock.
  const mockCtx = {
    clearRect: vi.fn(),
    resetTransform: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    roundRect: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textBaseline: '',
    globalAlpha: 1,
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

async function makeEditor(trackCount = 1, attrs: Record<string, string> = {}) {
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

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('<daw-editor> annotation lanes', () => {
  it('renders a lane with positioned boxes for a declarative annotation track', async () => {
    const editor = await makeEditor(); // loaded editor with ≥1 track
    editor.innerHTML +=
      '<daw-annotation-track id="lyrics">' +
      '<daw-annotation id="a" start="1" end="3">Hello</daw-annotation>' +
      '</daw-annotation-track>';
    await flush();
    await editor.updateComplete;
    const lane = editor.shadowRoot!.querySelector('.annotation-lane');
    expect(lane).toBeTruthy();
    const box = editor.shadowRoot!.querySelector('.annotation-box') as HTMLElement;
    expect(box).toBeTruthy();
    expect(box.getAttribute('data-annotation-id')).toBe('a');
    expect(box.style.left).toBe(Math.floor((1 * editor.effectiveSampleRate) / 1024) + 'px');
    editor.remove();
  });

  it('extends the temporal-mode timeline width to cover an annotation past the audio, and keeps working with indefinite-playback set', async () => {
    const editor = await makeEditor(1, { 'indefinite-playback': '' });
    const annotationEnd = 1000; // seconds — far past the short MIDI-clip duration
    editor.innerHTML += `<daw-annotation-track><daw-annotation start="0" end="${annotationEnd}">x</daw-annotation></daw-annotation-track>`;
    await flush();
    await editor.updateComplete;
    const timeline = editor.shadowRoot!.querySelector('.timeline') as HTMLElement;
    expect(timeline).toBeTruthy();
    const widthPx = parseFloat(timeline.style.width);
    const expectedMin = Math.floor(
      (annotationEnd * editor.effectiveSampleRate) / editor.samplesPerPixel
    );
    expect(widthPx).toBeGreaterThanOrEqual(expectedMin);
    editor.remove();
  });

  it('removing the annotation track removes the lane', async () => {
    const editor = await makeEditor();
    editor.innerHTML +=
      '<daw-annotation-track><daw-annotation start="0" end="1">x</daw-annotation></daw-annotation-track>';
    await flush();
    await editor.updateComplete;
    editor.querySelector('daw-annotation-track')!.remove();
    await flush();
    await editor.updateComplete;
    expect(editor.shadowRoot!.querySelector('.annotation-lane')).toBeNull();
    editor.remove();
  });

  it('re-derives tick annotation seconds when the engine BPM changes', async () => {
    const editor = await makeEditor();
    editor.innerHTML +=
      '<daw-annotation-track id="ticks">' +
      '<daw-annotation id="t1" start-tick="960" end-tick="1920"></daw-annotation>' +
      '</daw-annotation-track>';
    await flush();
    await editor.updateComplete;
    const el = editor.querySelector('#t1') as HTMLElement & { start: number; end: number };
    // Default 120 BPM, ppqn 960: 960 ticks = 0.5s.
    expect(el.start).toBeCloseTo(0.5);
    editor.bpm = 60;
    await editor.updateComplete;
    await flush();
    expect(el.start).toBeCloseTo(1);
    expect(el.end).toBeCloseTo(2);
    editor.remove();
  });
});
