import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

// #843: a take mutes the track it is recording onto through the engine
// (`setTrackRecording`), outside the undo history: the arrangement's
// `recordingTrackIds` holds that track, and the editor reads it (#848,
// `mixOf` / `loadedTrack`) for the controls and for an export.

vi.mock('@waveform-playlist/worklets', () => ({
  addRecordingWorkletModule: vi.fn(async (addModule: (url: string) => Promise<void>) => {
    await addModule('blob:mock-recording-processor');
  }),
}));

vi.mock('../interactions/export-audio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../interactions/export-audio')>()),
  exportAudioImpl: vi.fn(async () => ({}) as AudioBuffer),
}));

import { exportAudioImpl } from '../interactions/export-audio';

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
  // happy-dom 20 upgrades cloned <daw-piano-roll> only if defined before cloning.
  await import('../elements/daw-piano-roll');
});

beforeEach(() => {
  vi.stubGlobal('devicePixelRatio', 1);
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch should not be called')));
});

afterEach(() => {
  document.body.querySelectorAll('daw-editor').forEach((el) => el.remove());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A worklet node that acknowledges its own stop, as the real one does. */
function makeWorkletNode() {
  const node: any = {
    port: {
      onmessage: null,
      postMessage: vi.fn((msg: { command?: string }) => {
        if (msg?.command === 'stop' && node.port.onmessage) {
          node.port.onmessage({ data: { channels: [], channelCount: 1, done: true } });
        }
      }),
    },
    disconnect: vi.fn(),
  };
  return node;
}

function makeMockAdapter() {
  const ctx = {
    sampleRate: 48000,
    outputLatency: 0,
    state: 'running' as AudioContextState,
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
    setTrackVolume: vi.fn(),
    setTrackMute: vi.fn(),
    setTrackSolo: vi.fn(),
    setTrackPan: vi.fn(),
    init: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    isPlaying: vi.fn().mockReturnValue(false),
    addWorkletModule: vi.fn().mockResolvedValue(undefined),
    createAudioWorkletNode: vi.fn(() => makeWorkletNode()),
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
  };
}

function makeStream(): MediaStream {
  return {
    getAudioTracks: () => [
      {
        getSettings: () => ({ channelCount: 1 }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    ],
  } as unknown as MediaStream;
}

async function makeEditor() {
  const editor = document.createElement('daw-editor') as any;
  editor.adapter = makeMockAdapter();
  document.body.appendChild(editor);
  const aId: string = await editor.addTrack({ name: 'A' });
  const bId: string = await editor.addTrack({ name: 'B' });
  // The two adds are undo steps; a take's mute is measured from a clear history.
  editor.engine.clearHistory();
  return { editor, aId, bId };
}

function controlsFor(editor: any, trackId: string): any {
  const all = [...editor.shadowRoot.querySelectorAll('daw-track-controls')] as any[];
  return all.find((c) => c.trackId === trackId);
}

describe('<daw-editor> during a take (#843)', () => {
  it("the controls show the take's track muted, and no undo step is made", async () => {
    const { editor, aId, bId } = await makeEditor();
    const engine = editor.engine;
    expect(engine.canUndo).toBe(false);

    await editor.startRecording(makeStream(), { trackId: aId });
    expect(editor.isRecording).toBe(true);
    await editor.updateComplete;
    expect(controlsFor(editor, aId).muted).toBe(true);
    expect(controlsFor(editor, bId).muted).toBe(false);
    expect(engine.canUndo).toBe(false);

    await editor.stopRecording(); // no audio captured: the take ends without a clip
    await editor.updateComplete;
    expect(controlsFor(editor, aId).muted).toBe(false);
    expect(engine.canUndo).toBe(false);
  });

  it("the take's track's mute button is disabled during the take and enabled after", async () => {
    const { editor, aId, bId } = await makeEditor();
    const muteOf = (id: string) =>
      controlsFor(editor, id).shadowRoot.querySelector('button[title="Mute"]') as HTMLButtonElement;
    await editor.updateComplete;
    expect(controlsFor(editor, aId).recording).toBe(false);

    await editor.startRecording(makeStream(), { trackId: aId });
    await editor.updateComplete;
    await controlsFor(editor, aId).updateComplete;
    expect(controlsFor(editor, aId).recording).toBe(true);
    expect(controlsFor(editor, bId).recording).toBe(false);
    expect(muteOf(aId).disabled).toBe(true);
    expect(muteOf(bId).disabled).toBe(false);

    await editor.stopRecording();
    await editor.updateComplete;
    await controlsFor(editor, aId).updateComplete;
    expect(controlsFor(editor, aId).recording).toBe(false);
    expect(muteOf(aId).disabled).toBe(false);
  });

  it("an export during a take leaves the take's track out", async () => {
    const { editor, aId, bId } = await makeEditor();
    await editor.startRecording(makeStream(), { trackId: aId });

    await editor.exportAudio();

    // exportAudioImpl skips a muted track (export-audio.test.ts, "skips
    // muted tracks and honors solo"); the take's track is handed over muted.
    const host = vi.mocked(exportAudioImpl).mock.calls[0][0];
    expect(host.tracks.find((t) => t.id === aId)?.muted).toBe(true);
    expect(host.tracks.find((t) => t.id === bId)?.muted).toBe(false);

    await editor.stopRecording();
  });
});
