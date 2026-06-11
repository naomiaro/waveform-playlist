import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import type { DawEditorElement } from '../elements/daw-editor';

// Simulate @dawcore/faust not being installed: make the dynamic import reject.
vi.mock('@dawcore/faust', () => {
  throw new Error("Cannot find module '@dawcore/faust'");
});

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
});

function mockGainNode() {
  return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
}

function makeMockAdapter() {
  return {
    audioContext: {
      sampleRate: 48000,
      state: 'running' as AudioContextState,
      destination: { connect: vi.fn(), disconnect: vi.fn() },
      createGain: vi.fn(() => mockGainNode()),
      resume: vi.fn().mockResolvedValue(undefined),
      decodeAudioData: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as AudioContext,
    ppqn: 960,
    transport: {
      connectTrackOutput: vi.fn(),
      disconnectTrackOutput: vi.fn(),
      connectMasterOutput: vi.fn(),
      disconnectMasterOutput: vi.fn(),
      masterOutputNode: mockGainNode(),
    },
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

let editor: DawEditorElement;

beforeEach(() => {
  vi.stubGlobal('devicePixelRatio', 1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor = document.createElement('daw-editor') as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (editor as any).adapter = makeMockAdapter();
  document.body.appendChild(editor);
});

afterEach(() => {
  editor.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('addFaustEffect without @dawcore/faust installed', () => {
  it('rejects with an install hint and leaves the chain untouched', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(editor.addFaustEffect('process = _;')).rejects.toThrow(
      /npm install @dawcore\/faust/
    );

    expect(editor.effects).toHaveLength(0);
    // Original import error preserved as a diagnostic
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('@dawcore/faust'));
  });
});
