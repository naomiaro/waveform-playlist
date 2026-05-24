import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import type { DawEditorElement } from '../elements/daw-editor';

/**
 * Standalone test file for the install-hint branch of `editor.loadMidi()`.
 * Separated from `daw-editor-load-midi.test.ts` because that file uses
 * `vi.mock('@dawcore/midi', ...)` at file scope, which hoists and replaces
 * the module everywhere — incompatible with per-test `vi.doMock` swaps.
 *
 * Here we register a `vi.doMock` that makes the dynamic `import('@dawcore/midi')`
 * inside `loadMidiImpl` REJECT, simulating the package not being installed.
 * The loader should rethrow with the install-hint message AND console.warn
 * the original module-resolution error.
 */

vi.doMock('@dawcore/midi', () => {
  throw new Error("Cannot find module '@dawcore/midi'");
});

function makeMockAdapter() {
  const ctx = {
    sampleRate: 48000,
    state: 'suspended' as AudioContextState,
    currentTime: 0,
    destination: {} as AudioDestinationNode,
    resume: vi.fn().mockResolvedValue(undefined),
    decodeAudioData: vi.fn(),
    createMediaStreamSource: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    audioContext: ctx as unknown as AudioContext,
    ppqn: 960,
    setTracks: vi.fn(),
    updateTrack: vi.fn(),
    removeTrack: vi.fn(),
    setTempo: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    getPlaybackTime: vi.fn(() => 0),
    init: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    isPlaying: vi.fn().mockReturnValue(false),
  };
}

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
});

describe('<daw-editor>.loadMidi — @dawcore/midi unavailable', () => {
  let editor: DawEditorElement;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    editor = document.createElement('daw-editor') as DawEditorElement;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor.adapter = makeMockAdapter() as any;
    document.body.appendChild(editor);
  });

  afterEach(() => {
    editor.remove();
    warnSpy.mockRestore();
  });

  it('rejects with the friendly install hint when the package is missing', async () => {
    await expect(editor.loadMidi('/midi/x.mid')).rejects.toThrow(/npm install @dawcore\/midi/);
  });

  it('console.warns the original module-resolution error for debuggability', async () => {
    await expect(editor.loadMidi('/midi/x.mid')).rejects.toThrow();
    // The console.warn carries the underlying error so users can see WHY
    // the import failed (vs being told "install it" when it's actually a
    // broken exports map, CSP block, 404 chunk, etc.). We don't pin the
    // exact error message — vitest's module-mock surface may format it
    // slightly differently across versions — but the prefix and the
    // package name must be there.
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[dawcore] @dawcore/midi dynamic import failed:')
    );
  });
});
